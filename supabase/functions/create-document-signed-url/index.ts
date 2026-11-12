import { createClient } from "npm:@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";
import { checkUserRateLimit } from "../_shared/rateLimit.ts";

function readBearerToken(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
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
    console.error("create-document-signed-url is missing server configuration.");
    return json(503, { error: "Document access is not configured." });
  }

  let body: { documentId?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2048) {
      return json(413, { error: "Request is too large." });
    }
    const parsedBody: unknown = JSON.parse(rawBody);
    if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
      return json(400, { error: "Invalid JSON request body." });
    }
    body = parsedBody as { documentId?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
    return json(400, { error: "A valid document ID is required." });
  }

  // Verify the bearer token with Auth, then perform the document lookup under that user's JWT/RLS.
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
  const rateLimit = await checkUserRateLimit(adminClient, userId, "create_document_signed_url");
  if (!rateLimit.allowed) return json(rateLimit.status, {
    error: rateLimit.message,
    code: rateLimit.code,
    ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
  });

  const { data: document, error: documentError } = await userClient
    .from("documents")
    .select("id,user_id,storage_path,status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .in("status", ["uploaded", "processing", "ready"])
    .maybeSingle();

  if (documentError) {
    console.error("create-document-signed-url document lookup failed:", documentError.code);
    return json(500, { error: "Could not verify document access." });
  }
  if (!document) return json(404, { error: "Document not found." });

  // The database also enforces this ownership prefix; repeat it before privileged Storage access.
  // Never accept a bucket or object path from the browser.
  if (typeof document.storage_path !== "string" || !document.storage_path.startsWith(`${userId}/`)) {
    console.error("create-document-signed-url rejected a document with an invalid storage path.");
    return json(404, { error: "Document not found." });
  }

  const { data: signed, error: signError } = await adminClient.storage
    .from("documents")
    .createSignedUrl(document.storage_path, 300);

  if (signError || !signed?.signedUrl) {
    console.error("create-document-signed-url signing failed:", signError?.name ?? "unknown");
    return json(503, { error: "Could not create a document link. Please try again." });
  }

  return json(200, { signedUrl: signed.signedUrl, expiresIn: 300, status: document.status });
});
