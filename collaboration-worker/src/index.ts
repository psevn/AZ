interface Env {
  DOCUMENTS: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  COLLAB_TICKET_SECRET: string;
  APP_ORIGIN?: string;
}

interface TicketClaims {
  sub: string;
  documentId: string;
  projectId: string;
  role: string;
  exp: number;
}

const encoder = new TextEncoder();
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signTicket(claims: TicketClaims, secret: string): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + base64Url(signature);
}

async function supabaseGet(env: Env, path: string, accessToken: string): Promise<Response> {
  return fetch(env.SUPABASE_URL.replace(/\/$/, "") + path, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: "Bearer " + accessToken,
      accept: "application/json",
    },
  });
}

async function createTicket(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { documentId?: string };
  try {
    body = await request.json() as { documentId?: string };
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const documentId = body.documentId?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: "INVALID_DOCUMENT" }, 400);

  const userResponse = await supabaseGet(env, "/auth/v1/user", accessToken);
  if (!userResponse.ok) return json({ error: "AUTH_INVALID" }, 401);
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return json({ error: "AUTH_INVALID" }, 401);

  const documentResponse = await supabaseGet(
    env,
    "/rest/v1/project_documents?id=eq." + encodeURIComponent(documentId) + "&is_primary=eq.true&select=id,project_id",
    accessToken,
  );
  if (!documentResponse.ok) return json({ error: "DOCUMENT_LOOKUP_FAILED" }, 403);
  const documents = await documentResponse.json() as Array<{ id: string; project_id: string }>;
  const document = documents[0];
  if (!document) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);

  const memberResponse = await supabaseGet(
    env,
    "/rest/v1/project_members?project_id=eq." + encodeURIComponent(document.project_id) +
      "&user_id=eq." + encodeURIComponent(user.id) + "&select=role",
    accessToken,
  );
  if (!memberResponse.ok) return json({ error: "MEMBERSHIP_LOOKUP_FAILED" }, 403);
  const memberships = await memberResponse.json() as Array<{ role: string }>;
  const membership = memberships[0];
  if (!membership) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);

  const expiresAt = Math.floor(Date.now() / 1000) + 90;
  const token = await signTicket({
    sub: user.id,
    documentId: document.id,
    projectId: document.project_id,
    role: membership.role,
    exp: expiresAt,
  }, env.COLLAB_TICKET_SECRET);

  return json({ token, expiresAt });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const corsHeaders: HeadersInit = {
      "access-control-allow-origin": env.APP_ORIGIN || "",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, apikey",
      "vary": "Origin",
    };
    if (request.method === "OPTIONS") {
      if (origin && env.APP_ORIGIN && origin !== env.APP_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ service: "az-collaboration", status: "ready" });
    }

    if (url.pathname === "/ticket" && request.method === "POST") {
      if (origin && env.APP_ORIGIN && origin !== env.APP_ORIGIN) return json({ error: "ORIGIN_DENIED" }, 403);
      const response = await createTicket(request, env);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) if (value) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    }

    const match = url.pathname.match(/^\/collab\/([0-9a-f-]{36})$/i);
    if (!match || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "NOT_FOUND" }, 404);
    }

    const id = env.DOCUMENTS.idFromName(match[1].toLowerCase());
    const stub = env.DOCUMENTS.get(id);
    return stub.fetch(request);
  },
};

export { CollaborativeDocument } from "./CollaborativeDocument";
