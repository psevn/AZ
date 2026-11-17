import { createClient } from "npm:@supabase/supabase-js@2";

type InviteAction = "create" | "accept";

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
    },
  });
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration is incomplete" }, 500, allowedOrigin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice("Bearer ".length));
  if (authError || !authData.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401, allowedOrigin);
  }

  const user = authData.user;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: InviteAction; projectId?: string; invitedEmail?: string | null; token?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, allowedOrigin);
  }

  if (body.action === "create") {
    if (!isUuid(body.projectId)) return jsonResponse({ error: "Invalid project id" }, 400, allowedOrigin);

    const { data: membership, error: membershipError } = await serviceClient
      .from("project_members")
      .select("role,revoked_at")
      .eq("project_id", body.projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) return jsonResponse({ error: "Could not verify project role" }, 500, allowedOrigin);
    if (membership?.role !== "lead" || membership?.revoked_at !== null) {
      return jsonResponse({ error: "Only an active project lead can invite members" }, 403, allowedOrigin);
    }

    const invitedEmail = typeof body.invitedEmail === "string" ? body.invitedEmail.trim().toLowerCase() : null;
    if (invitedEmail && !isValidEmail(invitedEmail)) {
      return jsonResponse({ error: "Enter a valid email address" }, 400, allowedOrigin);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await serviceClient
      .from("project_invitations")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .gte("created_at", since);
    if (countError) return jsonResponse({ error: "Could not check invitation limits" }, 500, allowedOrigin);
    if ((count || 0) >= 20) return jsonResponse({ error: "Daily invitation limit reached" }, 429, allowedOrigin);

    const random = crypto.getRandomValues(new Uint8Array(32));
    const token = toHex(random);
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await serviceClient.from("project_invitations").insert({
      project_id: body.projectId,
      token_hash: tokenHash,
      invited_email: invitedEmail,
      role: "member",
      expires_at: expiresAt,
      created_by: user.id,
    });
    if (insertError) return jsonResponse({ error: "Could not create invitation" }, 500, allowedOrigin);

    await serviceClient.from("project_activity").insert({
      project_id: body.projectId,
      actor_id: user.id,
      event_type: "member_invited",
      payload: { invited_email: invitedEmail, expires_at: expiresAt },
    });

    return jsonResponse({ token, expiresAt, invitedEmail }, 201, allowedOrigin);
  }

  if (body.action === "accept") {
    if (typeof body.token !== "string" || !/^[0-9a-f]{64}$/i.test(body.token)) {
      return jsonResponse({ error: "Invalid invitation token" }, 400, allowedOrigin);
    }

    const tokenHash = await sha256(body.token.toLowerCase());
    const { data: projectId, error: acceptError } = await serviceClient.rpc("accept_project_invitation", {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_user_email: user.email || "",
    });

    if (acceptError) {
      const message = acceptError.message || "";
      const pendingRevocation = message.includes("PROJECT_MEMBER_REVOCATION_PENDING");
      const alreadyMember = message.includes("PROJECT_MEMBER_ALREADY_ACTIVE");
      const status = message.includes("EXPIRED") ? 410
        : message.includes("EMAIL_MISMATCH") ? 403
        : message.includes("ALREADY_USED") || pendingRevocation || alreadyMember ? 409
        : 400;
      return jsonResponse({ error: status === 410 ? "Invitation expired"
        : status === 403 ? "This invitation belongs to another email address"
        : pendingRevocation ? "Member removal is still pending; complete it before sending a new invitation"
        : alreadyMember ? "You are already an active project member"
        : status === 409 ? "Invitation has already been used"
        : "Invitation is invalid or unavailable" }, status, allowedOrigin);
    }

    return jsonResponse({ projectId }, 200, allowedOrigin);
  }

  return jsonResponse({ error: "Unsupported action" }, 400, allowedOrigin);
});
