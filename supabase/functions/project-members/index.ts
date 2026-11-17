import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(body: Record<string, unknown>, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request: Request) => {
  const configuredOrigin = Deno.env.get("APP_ORIGIN");
  const requestOrigin = request.headers.get("origin") || "*";
  const allowedOrigin = configuredOrigin
    ? (requestOrigin === configuredOrigin ? configuredOrigin : "")
    : "*";

  if (request.method === "OPTIONS") {
    if (!allowedOrigin) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin },
    });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, allowedOrigin || "*");
  if (!allowedOrigin) return jsonResponse({ error: "Origin not allowed" }, 403, "*");

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const revokeUrl = Deno.env.get("COLLAB_REVOKE_URL")?.replace(/\/$/, "");
  const revokeSecret = Deno.env.get("COLLAB_REVOKE_SECRET");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !revokeUrl || !revokeSecret || revokeSecret.length < 32) {
    return jsonResponse({ error: "Server configuration is incomplete" }, 503, allowedOrigin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401, allowedOrigin);
  }

  let body: { action?: string; projectId?: string; memberUserId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, allowedOrigin);
  }
  if (body.action !== "remove" || !isUuid(body.projectId) || !isUuid(body.memberUserId)) {
    return jsonResponse({ error: "Invalid member removal request" }, 400, allowedOrigin);
  }
  if (body.memberUserId === authData.user.id) {
    return jsonResponse({ error: "You cannot remove yourself from the project" }, 400, allowedOrigin);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [projectResult, actorResult, memberResult, documentsResult] = await Promise.all([
    serviceClient.from("projects").select("id,created_by").eq("id", body.projectId).maybeSingle(),
    serviceClient.from("project_members").select("role,revoked_at").eq("project_id", body.projectId)
      .eq("user_id", authData.user.id).maybeSingle(),
    serviceClient.from("project_members").select("role,revoked_at").eq("project_id", body.projectId)
      .eq("user_id", body.memberUserId).maybeSingle(),
    serviceClient.from("project_documents").select("id").eq("project_id", body.projectId),
  ]);

  if (projectResult.error || actorResult.error || memberResult.error || documentsResult.error) {
    return jsonResponse({ error: "Could not verify project membership" }, 500, allowedOrigin);
  }
  const project = projectResult.data;
  if (!project) return jsonResponse({ error: "Project not found" }, 404, allowedOrigin);
  if (actorResult.data?.role !== "lead" || actorResult.data?.revoked_at !== null) {
    return jsonResponse({ error: "Only the project lead can remove members" }, 403, allowedOrigin);
  }
  if (memberResult.data?.role !== "member" || body.memberUserId === project.created_by) {
    return jsonResponse({ error: "This project member cannot be removed" }, 409, allowedOrigin);
  }

  const { error: beginError } = await serviceClient.rpc("begin_project_member_removal", {
    p_project_id: body.projectId,
    p_member_user_id: body.memberUserId,
    p_actor_user_id: authData.user.id,
  });
  if (beginError) {
    const message = beginError.message || "";
    const status = message.includes("PROJECT_LEAD_REQUIRED") ? 403
      : message.includes("PROJECT_NOT_FOUND") ? 404
      : 409;
    return jsonResponse({ error: "Could not begin member removal" }, status, allowedOrigin);
  }

  // The database fence is already active. If any Worker acknowledgement fails,
  // leave the membership revoked and pending; existing sockets on an unacknowledged
  // document may remain connected until the lead retries successfully.
  for (const document of documentsResult.data || []) {
    let revokeResponse: Response;
    try {
      revokeResponse = await fetch(revokeUrl + "/internal/revoke", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + revokeSecret,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          documentId: document.id,
          projectId: body.projectId,
          userId: body.memberUserId,
        }),
      });
    } catch {
      return jsonResponse({ error: "Could not revoke active collaboration sessions" }, 503, allowedOrigin);
    }
    if (!revokeResponse.ok) {
      return jsonResponse({ error: "Could not revoke active collaboration sessions" }, 503, allowedOrigin);
    }
  }

  const { error: removeError } = await serviceClient.rpc("remove_project_member", {
    p_project_id: body.projectId,
    p_member_user_id: body.memberUserId,
    p_actor_user_id: authData.user.id,
  });
  if (removeError) {
    const message = removeError.message || "";
    const status = message.includes("PROJECT_LEAD_REQUIRED") ? 403
      : message.includes("PROJECT_NOT_FOUND") ? 404
      : 409;
    return jsonResponse({ error: "Could not remove this project member" }, status, allowedOrigin);
  }

  return jsonResponse({ removed: true, projectId: body.projectId }, 200, allowedOrigin);
});
