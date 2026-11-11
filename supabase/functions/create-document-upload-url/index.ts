import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  let body: { documentId?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2048) return json(413, { error: "Request is too large." });
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return json(400, { error: "Invalid JSON request body." });
    }
    body = parsed as { documentId?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
    return json(400, { error: "A valid document ID is required." });
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
    .select("id,user_id,storage_path,status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("status", "uploaded")
    .maybeSingle();

  if (documentError) {
    console.error("create-document-upload-url document lookup failed:", documentError.code);
    return json(500, { error: "Could not verify document upload." });
  }
  if (!document || document.storage_path !== `${userId}/${documentId}.pdf`) {
    return json(404, { error: "Upload record not found." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signed, error: signError } = await adminClient.storage
    .from("documents")
    .createSignedUploadUrl(document.storage_path, { upsert: false });

  if (signError || !signed?.token || !signed?.path) {
    console.error("create-document-upload-url signing failed:", signError?.name ?? "unknown");
    return json(503, { error: "Could not prepare the upload. Please try again." });
  }

  return json(200, { path: signed.path, token: signed.token });
});
