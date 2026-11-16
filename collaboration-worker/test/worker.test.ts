import { env, exports } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { network } from "./network";

const userId = "00000000-0000-4000-8000-000000000011";
const documentId = "00000000-0000-4000-8000-000000000022";
const projectId = "00000000-0000-4000-8000-000000000033";
const accessToken = "supabase-test-access-token";
const supabaseOrigin = "https://example.supabase.co";

function ticketRequest(
  body: unknown = { documentId },
  options: { authorization?: string; origin?: string } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.authorization !== undefined) headers.set("authorization", options.authorization);
  if (options.origin !== undefined) headers.set("origin", options.origin);
  return new Request("http://az-collaboration/ticket", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("AZ collaboration Worker runtime", () => {
  it("exposes a health endpoint", async () => {
    const response = await exports.default.fetch(new Request("http://az-collaboration/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: "az-collaboration",
      status: "ready",
    });
  });

  it("rejects non-WebSocket collaboration routes", async () => {
    const response = await exports.default.fetch(
      new Request("http://az-collaboration/collab/00000000-0000-4000-8000-000000000001"),
    );
    expect(response.status).toBe(404);
  });

  it("can instantiate a document Durable Object", async () => {
    const id = env.DOCUMENTS.idFromName("00000000-0000-4000-8000-000000000001");
    const stub = env.DOCUMENTS.get(id);
    const response = await stub.fetch(new Request("http://document/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      document: "unbound",
    });
  });

  it("requires a Supabase bearer token before calling Supabase", async () => {
    const response = await exports.default.fetch(ticketRequest(undefined, { authorization: "" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTH_REQUIRED" });
  });

  it("rejects malformed document ids before querying Supabase", async () => {
    const response = await exports.default.fetch(ticketRequest({ documentId: "not-a-uuid" }, {
      authorization: "Bearer " + accessToken,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_DOCUMENT" });
  });

  it("issues a short-lived ticket only after auth, document, and membership checks", async () => {
    network.use(
      http.get(supabaseOrigin + "/auth/v1/user", ({ request }) => {
        expect(request.headers.get("apikey")).toBe("test-anon-key");
        expect(request.headers.get("authorization")).toBe("Bearer " + accessToken);
        return HttpResponse.json({ id: userId });
      }),
      http.get(supabaseOrigin + "/rest/v1/project_documents", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("id")).toBe("eq." + documentId);
        expect(url.searchParams.get("is_primary")).toBe("eq.true");
        expect(url.searchParams.get("select")).toBe("id,project_id");
        return HttpResponse.json([{ id: documentId, project_id: projectId }]);
      }),
      http.get(supabaseOrigin + "/rest/v1/project_members", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("project_id")).toBe("eq." + projectId);
        expect(url.searchParams.get("user_id")).toBe("eq." + userId);
        expect(url.searchParams.get("select")).toBe("role");
        return HttpResponse.json([{ role: "lead" }]);
      }),
    );

    const response = await exports.default.fetch(ticketRequest({ documentId }, {
      authorization: "Bearer " + accessToken,
      origin: "http://localhost:5173",
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

    const result = await response.json() as { token: string; expiresAt: number };
    expect(result.token.split(".")).toHaveLength(2);
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(result.expiresAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 900);

    const payload = result.token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload + "=".repeat((4 - payload.length % 4) % 4))) as {
      sub: string; documentId: string; projectId: string; role: string; exp: number;
    };
    expect(claims).toEqual({
      sub: userId,
      documentId,
      projectId,
      role: "lead",
      exp: result.expiresAt,
      iatMs: expect.any(Number),
    });
  });

  it("denies a valid user who is not a member of the document project", async () => {
    network.use(
      http.get(supabaseOrigin + "/auth/v1/user", () => HttpResponse.json({ id: userId })),
      http.get(supabaseOrigin + "/rest/v1/project_documents", () =>
        HttpResponse.json([{ id: documentId, project_id: projectId }])),
      http.get(supabaseOrigin + "/rest/v1/project_members", () => HttpResponse.json([])),
    );

    const response = await exports.default.fetch(ticketRequest({ documentId }, {
      authorization: "Bearer " + accessToken,
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "PROJECT_ACCESS_DENIED" });
  });

  it("requires the internal revocation secret before addressing a document", async () => {
    const response = await exports.default.fetch(new Request("http://az-collaboration/internal/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId, projectId, userId }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("accepts a trusted revocation request and routes it to the document Durable Object", async () => {
    const response = await exports.default.fetch(new Request("http://az-collaboration/internal/revoke", {
      method: "POST",
      headers: {
        authorization: "Bearer test-only-revoke-secret-that-is-long-enough",
        "content-type": "application/json",
      },
      body: JSON.stringify({ documentId, projectId, userId }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revoked: true, closedConnections: 0 });
  });

  it("rejects a disallowed browser origin without contacting Supabase", async () => {
    const response = await exports.default.fetch(ticketRequest({ documentId }, {
      authorization: "Bearer " + accessToken,
      origin: "https://attacker.example",
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ORIGIN_DENIED" });
  });
});
