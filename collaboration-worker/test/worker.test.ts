import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "00000000-0000-4000-8000-000000000011";
const documentId = "00000000-0000-4000-8000-000000000022";
const projectId = "00000000-0000-4000-8000-000000000033";
const accessToken = "supabase-test-access-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await exports.default.fetch(ticketRequest(undefined, { authorization: "" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTH_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed document ids before querying Supabase", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await exports.default.fetch(ticketRequest({ documentId: "not-a-uuid" }, {
      authorization: "Bearer " + accessToken,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_DOCUMENT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a short-lived ticket only after auth, document, and membership checks", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: userId }))
      .mockResolvedValueOnce(jsonResponse([{ id: documentId, project_id: projectId }]))
      .mockResolvedValueOnce(jsonResponse([{ role: "lead" }]));
    vi.stubGlobal("fetch", fetchMock);

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
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [authUrl, authInit] = fetchMock.mock.calls[0];
    expect(String(authUrl)).toBe("https://example.supabase.co/auth/v1/user");
    expect(new Headers(authInit?.headers).get("apikey")).toBe("test-anon-key");
    expect(new Headers(authInit?.headers).get("authorization")).toBe("Bearer " + accessToken);

    const [documentUrl] = fetchMock.mock.calls[1];
    expect(String(documentUrl)).toContain("/rest/v1/project_documents?");
    expect(String(documentUrl)).toContain("is_primary=eq.true");
    const [membershipUrl] = fetchMock.mock.calls[2];
    expect(String(membershipUrl)).toContain("/rest/v1/project_members?");
    expect(String(membershipUrl)).toContain(encodeURIComponent(userId));
  });

  it("denies a valid user who is not a member of the document project", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: userId }))
      .mockResolvedValueOnce(jsonResponse([{ id: documentId, project_id: projectId }]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const response = await exports.default.fetch(ticketRequest({ documentId }, {
      authorization: "Bearer " + accessToken,
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "PROJECT_ACCESS_DENIED" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a disallowed browser origin without contacting Supabase", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await exports.default.fetch(ticketRequest({ documentId }, {
      authorization: "Bearer " + accessToken,
      origin: "https://attacker.example",
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ORIGIN_DENIED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
