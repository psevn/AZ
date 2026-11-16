import { createClient } from "npm:@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";
import { checkUserRateLimit } from "../_shared/rateLimit.ts";
import { getUploadTokenExpiryDecision } from "../_shared/uploadTokenExpiry.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2048;
const UPLOAD_CLOCK_SKEW_MS = 5 * 60 * 1000;

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRow(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
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
    console.error("delete-document is missing server configuration.");
    return json(503, { error: "Document deletion is not configured." });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json(413, { error: "Request is too large." });
    }
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }
  if (!isRecord(body) || typeof body.documentId !== "string" || !UUID_RE.test(body.documentId)) {
    return json(400, { error: "A valid document ID is required." });
  }
  const documentId = body.documentId;

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Your session is invalid or expired." });

  const userId = authData.user.id;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Deletion shares the existing document-processing rate-limit bucket so this
  // endpoint is protected without adding an unreviewed quota key to app_config.
  const rateLimit = await checkUserRateLimit(adminClient, userId, "process_document_pages");
  if (!rateLimit.allowed) return json(rateLimit.status, {
    error: rateLimit.message,
    code: rateLimit.code,
    ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
  });

  const { data: beginData, error: beginError } = await adminClient.rpc("begin_document_deletion", {
    p_document_id: documentId,
    p_user_id: userId,
  });
  if (beginError) {
    console.error("delete-document begin RPC failed:", beginError.code);
    return json(503, { error: "Could not start document deletion.", code: "DELETE_START_UNAVAILABLE" });
  }

  const begun = firstRow(beginData);
  if (!isRecord(begun) || begun.ok !== true) {
    const code = isRecord(begun) && typeof begun.code === "string" ? begun.code : "DELETE_START_FAILED";
    const status = isRecord(begun) && typeof begun.statusCode === "number" ? begun.statusCode : 503;
    if (status === 404) return json(404, { error: "Document not found.", code });
    if (status === 409) return json(409, { error: "Document cannot be deleted safely.", code });
    return json(status, { error: "Could not start document deletion.", code });
  }

  const storagePath = begun.storagePath;
  if (typeof storagePath !== "string" || storagePath !== `${userId}/${documentId}.pdf`) {
    console.error("delete-document rejected a non-canonical storage path.");
    return json(409, { error: "Document storage path is invalid.", code: "DOCUMENT_PATH_INVALID" });
  }

  const expiryDecision = getUploadTokenExpiryDecision(
    begun.uploadTokenExpiresAt,
    Date.now(),
    UPLOAD_CLOCK_SKEW_MS,
  );
  if (expiryDecision.kind === "invalid") {
    console.error("delete-document rejected an invalid upload-token expiry value.");
    return json(503, {
      error: "Upload-token expiry could not be verified. Please retry.",
      code: "UPLOAD_EXPIRY_STATE_INVALID",
    });
  }
  if (expiryDecision.kind === "wait") {
    return json(202, {
      ok: true,
      status: "deleting",
      retryAfterSeconds: expiryDecision.retryAfterSeconds,
    });
  }

  const bucket = adminClient.storage.from("documents");
  const { error: removeError } = await bucket.remove([storagePath]);

  // A remove error is only treated as an idempotent absence when Storage API
  // listing independently confirms that the exact canonical object is gone.
  const { data: remaining, error: listError } = await bucket.list(userId, {
    limit: 100,
    search: `${documentId}.pdf`,
  });
  if (listError) {
    console.error("delete-document Storage verification failed:", listError.name);
    return json(503, { error: "Storage cleanup could not be verified.", code: "STORAGE_VERIFY_FAILED" });
  }
  const objectStillExists = (remaining ?? []).some((item) => item.name === `${documentId}.pdf`);
  if (objectStillExists) {
    console.error("delete-document Storage removal was not confirmed:", removeError?.name ?? "object_still_exists");
    return json(503, { error: "Storage cleanup is pending. Please retry.", code: "STORAGE_REMOVE_PENDING" });
  }

  const { data: completeData, error: completeError } = await adminClient.rpc("complete_document_deletion", {
    p_document_id: documentId,
    p_user_id: userId,
  });
  if (completeError) {
    console.error("delete-document completion RPC failed:", completeError.code);
    return json(503, { error: "Storage was cleaned, but document deletion needs another retry.", code: "DELETE_FINALIZE_PENDING" });
  }

  const completed = firstRow(completeData);
  if (!isRecord(completed) || completed.ok !== true) {
    const code = isRecord(completed) && typeof completed.code === "string" ? completed.code : "DELETE_FINALIZE_FAILED";
    if (code === "UPLOAD_TOKEN_WINDOW_ACTIVE") {
      return json(202, { ok: true, status: "deleting", retryAfterSeconds: 300 });
    }
    return json(503, { error: "Storage was cleaned, but document deletion needs another retry.", code });
  }

  return json(200, { ok: true, status: "deleted" });
});
