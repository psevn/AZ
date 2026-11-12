import { createClient } from "npm:@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";
import { checkUserRateLimit } from "../_shared/rateLimit.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 400 * 1024;
const MAX_PAGES_PER_BATCH = 20;
const MAX_PAGE_CHARS = 18_000;
const MAX_DOCUMENT_PAGES = 1_000;

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("too_large");
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (request: Request) => {
  const cors = corsForRequest(request);
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: cors.headers });
  if (!cors.allowed) return json(cors.status, {
    error: cors.code === "CORS_NOT_CONFIGURED"
      ? "This Edge Function has no configured browser origin allowlist."
      : "This request origin is not allowed.",
    code: cors.code ?? "CORS_REJECTED",
  });
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const token = readBearerToken(request);
  if (!token) return json(401, { error: "Authentication required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("process-document-pages is missing server configuration.");
    return json(503, { error: "Document processing is not configured." });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await readLimitedBody(request);
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) return json(400, { error: "Invalid JSON request body." });
    body = parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") {
      return json(413, { error: "Processing batch is too large." });
    }
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!UUID_RE.test(documentId)) return json(400, { error: "A valid document ID is required." });

  const action = body.action;
  if (action !== "start" && action !== "save_pages" && action !== "complete" && action !== "fail" && action !== "resume") {
    return json(400, { error: "Unsupported processing action." });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Your session is invalid or expired." });

  const userId = authData.user.id;
  const { data: document, error: documentError } = await userClient
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (documentError) {
    console.error("process-document-pages document lookup failed:", documentError.code);
    return json(500, { error: "Could not verify document access." });
  }
  if (!document) return json(404, { error: "Document not found." });

  if (action === "save_pages") {
    if (!Array.isArray(body.pages) || body.pages.length < 1 || body.pages.length > MAX_PAGES_PER_BATCH) {
      return json(400, { error: "A batch must contain between 1 and 20 pages." });
    }
    const seen = new Set<number>();
    let totalChars = 0;
    for (const page of body.pages) {
      if (!isRecord(page) || typeof page.pageNo !== "number" || !Number.isInteger(page.pageNo) ||
          page.pageNo < 1 || page.pageNo > MAX_DOCUMENT_PAGES ||
          typeof page.text !== "string" || page.text.length > MAX_PAGE_CHARS ||
          page.text.includes("\u0000")) {
        return json(400, { error: "A page contains invalid text or page metadata." });
      }
      if (seen.has(page.pageNo)) return json(400, { error: "A batch cannot contain duplicate page numbers." });
      seen.add(page.pageNo);
      totalChars += page.text.length;
      if (totalChars > 300_000) return json(413, { error: "Page text batch is too large." });
    }
  }

  if (action === "complete" &&
      (typeof body.pageCount !== "number" || !Number.isInteger(body.pageCount) ||
       body.pageCount < 1 || body.pageCount > MAX_DOCUMENT_PAGES)) {
    return json(400, { error: "A valid page count is required." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rateLimitEndpoint = action === "save_pages"
    ? "process_document_pages_save_pages"
    : "process_document_pages";
  const rateLimit = await checkUserRateLimit(adminClient, userId, rateLimitEndpoint);
  if (!rateLimit.allowed) return json(rateLimit.status, {
    error: rateLimit.message,
    code: rateLimit.code,
    ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
  });

  const processingToken = typeof body.processingToken === "string" && Number.isFinite(Date.parse(body.processingToken))
    ? body.processingToken
    : null;
  const { data, error } = await adminClient.rpc("process_document_pages_atomic", {
    p_action: action,
    p_document_id: documentId,
    p_user_id: userId,
    p_processing_token: processingToken,
    p_pages: action === "save_pages" ? body.pages : null,
    p_page_count: action === "complete" ? body.pageCount : null,
    p_failure_reason: action === "fail" && typeof body.reasonCode === "string" ? body.reasonCode : "processing_failed",
  });

  if (error) {
    const message = typeof error.message === "string" ? error.message : "";
    const quotaFailures: Record<string, { status: number; error: string }> = {
      DOCUMENT_PAGE_LIMIT_EXCEEDED: { status: 413, error: "The total page limit for your plan has been reached." },
      DOCUMENT_TEXT_LIMIT_EXCEEDED: { status: 413, error: "The extracted-text limit for your plan has been reached." },
      DOCUMENT_LIMITS_NOT_CONFIGURED: { status: 503, error: "Document limits are not configured yet." },
    };
    const matchedCode = Object.keys(quotaFailures).find((code) => message.includes(code));
    if (matchedCode) {
      return json(quotaFailures[matchedCode].status, { error: quotaFailures[matchedCode].error, code: matchedCode });
    }
    console.error("process-document-pages atomic RPC failed:", error.code);
    return json(500, { error: "Could not update document processing state." });
  }
  if (!isRecord(data) || data.ok !== true) {
    const statusCode = isRecord(data) && typeof data.statusCode === "number" ? data.statusCode : 500;
    const message = isRecord(data) && typeof data.error === "string"
      ? data.error
      : "Document processing did not complete.";
    return json(statusCode, {
      error: message,
      ...(isRecord(data) && typeof data.code === "string" ? { code: data.code } : {}),
    });
  }
  return json(200, data);
});
