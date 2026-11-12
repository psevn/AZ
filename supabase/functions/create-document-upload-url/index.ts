import { createClient } from "npm:@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";
import { checkUserRateLimit } from "../_shared/rateLimit.ts";

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const token = readBearerToken(request);
  if (!token) return json(401, { error: "Authentication required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("create-document-upload-url is missing server configuration.");
    return json(503, { error: "Document upload is not configured." });
  }

  let body: { documentId?: unknown; title?: unknown; action?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2048) return json(413, { error: "Request is too large." });
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return json(400, { error: "Invalid JSON request body." });
    }
    body = parsed as { documentId?: unknown; title?: unknown; action?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  if (!isUuid(body.documentId)) return json(400, { error: "A valid document ID is required." });
  const documentId = body.documentId;
  const action = body.action === undefined ? "create_upload" : body.action;
  if (action !== "create_upload" && action !== "mark_failed") {
    return json(400, { error: "Unsupported upload action." });
  }

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
  const rateLimit = await checkUserRateLimit(adminClient, userId, "create_document_upload_url");
  if (!rateLimit.allowed) return json(rateLimit.status, {
    error: rateLimit.message,
    code: rateLimit.code,
    ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
  });

  const storagePath = `${userId}/${documentId}.pdf`;

  if (action === "mark_failed") {
    const { data: existing, error: lookupError } = await adminClient
      .from("documents").select("id").eq("id", documentId).eq("user_id", userId)
      .eq("status", "uploaded").maybeSingle();
    if (lookupError) {
      console.error("create-document-upload-url failure lookup failed:", lookupError.code);
      return json(500, { error: "Could not update the upload status." });
    }
    if (!existing) return json(404, { error: "Upload record not found." });

    const { error: updateError } = await adminClient.from("documents")
      .update({ status: "failed", failed_reason: "Upload did not complete." })
      .eq("id", documentId).eq("user_id", userId).eq("status", "uploaded");
    if (updateError) {
      console.error("create-document-upload-url failure update failed:", updateError.code);
      return json(500, { error: "Could not update the upload status." });
    }
    return json(200, { ok: true });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
  if (!title) return json(400, { error: "A document title is required." });

  const { data: created, error: insertError } = await adminClient.rpc("create_document_upload_record", {
    p_user_id: userId,
    p_document_id: documentId,
    p_title: title,
    p_storage_path: storagePath,
  });
  if (insertError) {
    console.error("create-document-upload-url document reservation failed:", insertError.code);
    return json(503, { error: "Document limits are not ready. Please try again later.", code: "DOCUMENT_LIMITS_NOT_CONFIGURED" });
  }
  const creation = Array.isArray(created) ? created[0] : created;
  if (!creation || creation.ok !== true) {
    const code = typeof creation?.code === "string" ? creation.code : "DOCUMENT_CREATE_FAILED";
    const statusCode = typeof creation?.statusCode === "number" ? creation.statusCode : 409;
    const messages: Record<string, string> = {
      ACTIVE_DOCUMENT_LIMIT_EXCEEDED: "You already have the maximum number of uploads or documents currently processing.",
      DOCUMENT_LIMIT_EXCEEDED: "You have reached the maximum number of documents for your plan.",
      DOCUMENT_PAGE_LIMIT_EXCEEDED: "You have reached the total page limit for your plan.",
      DOCUMENT_TEXT_LIMIT_EXCEEDED: "You have reached the extracted-text storage limit for your plan.",
      DOCUMENT_LIMITS_NOT_CONFIGURED: "Document limits are not configured yet. Please contact the AZ owner.",
    };
    return json(statusCode, { error: messages[code] ?? "Could not create this document upload.", code });
  }

  const { data: signed, error: signError } = await adminClient.storage
    .from("documents").createSignedUploadUrl(storagePath, { upsert: false });
  if (signError || !signed?.token || !signed?.path) {
    await adminClient.from("documents")
      .update({ status: "failed", failed_reason: "Could not prepare the upload." })
      .eq("id", documentId).eq("user_id", userId).eq("status", "uploaded");
    console.error("create-document-upload-url signing failed:", signError?.name ?? "unknown");
    return json(503, { error: "Could not prepare the upload. Please try again." });
  }

  return json(200, { documentId, path: signed.path, token: signed.token });
});
