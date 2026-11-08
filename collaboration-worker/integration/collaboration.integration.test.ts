import { HocuspocusProvider } from "@hocuspocus/provider";
import { createTestHarness } from "wrangler";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";

const ticketSecret = "test-only-secret-that-is-long-enough-for-local-tests";
const harness = createTestHarness({
  workers: [{
    configPath: "./wrangler.jsonc",
    vars: { APP_ORIGIN: "http://localhost:5173" },
    secrets: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      COLLAB_TICKET_SECRET: ticketSecret,
    },
  }],
});

let workerUrl: URL;

beforeAll(async () => {
  ({ url: workerUrl } = await harness.listen());
}, 30_000);

afterAll(async () => {
  await harness.close();
});

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function makeTicket(documentId: string): Promise<string> {
  const claims = {
    sub: "10000000-0000-4000-8000-000000000001",
    documentId,
    projectId: "20000000-0000-4000-8000-000000000002",
    role: "member",
    exp: Math.floor(Date.now() / 1000) + 120,
  };
  const payload = base64Url(encoder.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ticketSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + base64Url(signature);
}

function waitForSync(
  create: (onSynced: () => void, onFailure: (reason: string) => void) => HocuspocusProvider,
): Promise<HocuspocusProvider> {
  return new Promise((resolve, reject) => {
    let provider: HocuspocusProvider;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        provider?.destroy();
        reject(new Error("Timed out waiting for Hocuspocus initial sync"));
      }
    }, 10_000);
    provider = create(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(provider);
      },
      (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        provider?.destroy();
        reject(new Error("Hocuspocus authentication failed: " + reason));
      },
    );
  });
}

async function waitForValue(check: () => boolean, message: string, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("AZ collaboration Worker end-to-end", () => {
  it("synchronizes two users, shares presence, and restores the document after reconnect", async () => {
    const documentId = "30000000-0000-4000-8000-000000000003";
    const token = await makeTicket(documentId);
    const socketUrl = new URL("/collab/" + documentId, workerUrl);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";

    const firstDoc = new Y.Doc();
    const secondDoc = new Y.Doc();
    let firstProvider: HocuspocusProvider | undefined;
    let secondProvider: HocuspocusProvider | undefined;
    let restoredProvider: HocuspocusProvider | undefined;

    const createProvider = (document: Y.Doc) => (
      onSynced: () => void,
      onFailure: (reason: string) => void,
    ) => new HocuspocusProvider({
      url: socketUrl.toString(),
      name: documentId,
      document,
      token,
      WebSocketPolyfill: WebSocket,
      onSynced: ({ state }) => { if (state) onSynced(); },
      onAuthenticationFailed: ({ reason }) => onFailure(reason),
    });

    try {
      firstProvider = await waitForSync(createProvider(firstDoc));
      secondProvider = await waitForSync(createProvider(secondDoc));

      firstDoc.getText("content").insert(0, "AZ real-time collaboration");
      await waitForValue(
        () => secondDoc.getText("content").toString() === "AZ real-time collaboration",
        "The second client did not receive the first client's edit",
      );
      expect(secondDoc.getText("content").toString()).toBe("AZ real-time collaboration");

      firstProvider.setAwarenessField("user", { name: "First member" });
      await waitForValue(
        () => [...(secondProvider?.awareness?.getStates().values() || [])]
          .some((state) => (state.user as { name?: string } | undefined)?.name === "First member"),
        "The second client did not receive the first client's presence state",
      );

      // Allow Hocuspocus' configured persistence debounce to complete before disconnecting.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      firstProvider.destroy();
      secondProvider.destroy();
      firstProvider = undefined;
      secondProvider = undefined;

      const restoredDoc = new Y.Doc();
      restoredProvider = await waitForSync(createProvider(restoredDoc));
      expect(restoredDoc.getText("content").toString()).toBe("AZ real-time collaboration");
      restoredProvider.destroy();
      restoredDoc.destroy();
    } finally {
      firstProvider?.destroy();
      secondProvider?.destroy();
      restoredProvider?.destroy();
      firstDoc.destroy();
      secondDoc.destroy();
    }
  }, 45_000);
});
