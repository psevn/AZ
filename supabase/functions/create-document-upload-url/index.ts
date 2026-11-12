import { checkUserRateLimit } from "../_shared/rateLimit.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveCors } from "../_shared/cors.ts";

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request: Request) => {
  const cors = resolveCors(request);
  const json = (status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors.headers, "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
    });
  if (!cors.allowed) return json(cors.status, { error: cors.message, code: cors.code });
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
  if (!rateLimit.allowed) {
    return json(rateLimit.status, {
      error: rateLimit.message, code: rateLimit.code, retryAfterSeconds: rateLimit.retryAfterSeconds,
    }, rateLimit.status === 429 ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : {});
  }

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

  const { data: reservation, error: reservationError } = await adminClient.rpc("create_document_upload_record", {
    p_document_id: documentId,
    p_user_id: userId,
    p_title: title,
    p_storage_path: storagePath,
  });
  if (reservationError || !isRecord(reservation)) {
    console.error("create-document-upload-url reservation failed:", reservationError?.code ?? "invalid-rpc-result");
    return json(503, { error: "Could not reserve document storage. Please try again." });
  }

  const expiredPaths = Array.isArray(reservation.expired_paths)
    ? reservation.expired_paths.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    : [];
  if (expiredPaths.length) {
    const { error: cleanupError } = await adminClient.storage.from("documents").remove(expiredPaths);
    if (cleanupError) {
      if (reservation.ok === true) {
        await adminClient.from("documents").delete()
          .eq("id", documentId).eq("user_id", userId).eq("status", "uploaded");
      }
      console.error("Expired document upload cleanup failed:", cleanupError.name);
      return json(503, { error: "Could not clean expired uploads safely. Please retry." });
    }
    const { error: expiredRowDeleteError } = await adminClient.from("documents").delete()
      .eq("user_id", userId)
      .eq("status", "failed")
      .eq("failed_reason", "Upload expired before completion.")
      .in("storage_path", expiredPaths);
    if (expiredRowDeleteError) {
      console.error("Expired document row cleanup failed:", expiredRowDeleteError.code);
      if (reservation.ok === true) {
        await adminClient.from("documents").delete()
          .eq("id", documentId).eq("user_id", userId).eq("status", "uploaded");
      }
      return json(503, { error: "Could not finalize expired uploads safely. Please retry." });
    }
  }

  if (reservation.ok !== true) {
    const code = typeof reservation.error_code === "string" ? reservation.error_code : "DOCUMENT_LIMIT_UNKNOWN";
    const messages: Record<string, string> = {
      DOCUMENT_LIMIT_DOCUMENTS: "You have reached the document limit for your plan.",
      DOCUMENT_LIMIT_PENDING_UPLOADS: "Too many document uploads are still pending. Finish or retry an existing upload first.",
      DOCUMENT_LIMIT_TOTAL_PAGES: "You have reached the total page limit for your plan.",
      DOCUMENT_LIMIT_TOTAL_TEXT_CHARS: "You have reached the extracted-text limit for your plan.",
      DOCUMENT_LIMIT_CONFIGURATION_MISSING: "Document limits are not configured for this plan yet.",
      DOCUMENT_LIMIT_CONFIGURATION_INVALID: "Document limits are configured incorrectly.",
      DOCUMENT_LIMIT_PROFILE_MISSING: "Your account profile could not be found.",
      DOCUMENT_UPLOAD_INVALID_INPUT: "The document upload details are invalid.",
    };
    const limitExceeded = new Set([
      "DOCUMENT_LIMIT_DOCUMENTS",
      "DOCUMENT_LIMIT_PENDING_UPLOADS",
      "DOCUMENT_LIMIT_TOTAL_PAGES",
      "DOCUMENT_LIMIT_TOTAL_TEXT_CHARS",
    ]).has(code);
    return json(limitExceeded ? 429 : code === "DOCUMENT_UPLOAD_INVALID_INPUT" ? 400 : 503, {
      error: messages[code] ?? "Could not reserve document storage.",
      code,
    });
  }

  const { data: signed, error: signError } = await adminClient.storage
    .from("documents").createSignedUploadUrl(storagePath, { upsert: false });
  if (signError || !signed?.token || !signed?.path) {
    const { error: deleteError } = await adminClient.from("documents")
      .delete().eq("id", documentId).eq("user_id", userId).eq("status", "uploaded");
    if (deleteError) console.error("create-document-upload-url failed-row cleanup failed:", deleteError.code);
    console.error("create-document-upload-url signing failed:", signError?.name ?? "unknown");
    return json(503, { error: "Could not prepare the upload. Please try again." });
  }

  return json(200, { documentId, path: signed.path, token: signed.token });
});
