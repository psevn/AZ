import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

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
});
