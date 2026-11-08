import { HocuspocusProvider } from "@hocuspocus/provider";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

type LocalSocket = WebSocket & { accept?: () => void };

class WorkerLoopbackWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readonly url: string;
  readonly extensions = "";
  readonly protocol = "";
  bufferedAmount = 0;
  binaryType: BinaryType = "arraybuffer";
  readyState = WorkerLoopbackWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  private socket: LocalSocket | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    queueMicrotask(() => void this.connect());
  }

  private dispatchWithHandler(type: "open" | "message" | "error" | "close", event: Event) {
    this.dispatchEvent(event);
    if (type === "open") this.onopen?.(event);
    if (type === "message") this.onmessage?.(event as MessageEvent);
    if (type === "error") this.onerror?.(event);
    if (type === "close") this.onclose?.(event as CloseEvent);
  }

  private async connect() {
    try {
      const target = new URL(this.url);
      const response = await exports.default.fetch(new Request(
        "http://az-collaboration" + target.pathname,
        { headers: { upgrade: "websocket", origin: "http://localhost:5173" } },
      ));
      if (response.status !== 101) throw new Error("Worker rejected WebSocket upgrade: " + response.status);
      const socket = (response as Response & { webSocket?: LocalSocket }).webSocket;
      if (!socket) throw new Error("Worker response did not expose its client WebSocket");
      this.socket = socket;
      socket.addEventListener("message", (event) => {
        this.dispatchWithHandler("message", new MessageEvent("message", { data: event.data }));
      });
      socket.addEventListener("close", (event) => {
        this.readyState = WorkerLoopbackWebSocket.CLOSED;
        const closeEvent = Object.assign(new Event("close"), {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.dispatchWithHandler("close", closeEvent);
      });
      socket.addEventListener("error", () => {
        this.dispatchWithHandler("error", new Event("error"));
      });
      socket.accept?.();
      this.readyState = WorkerLoopbackWebSocket.OPEN;
      this.dispatchWithHandler("open", new Event("open"));
    } catch {
      this.readyState = WorkerLoopbackWebSocket.CLOSED;
      this.dispatchWithHandler("error", new Event("error"));
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.readyState !== WorkerLoopbackWebSocket.OPEN || !this.socket) {
      throw new Error("WebSocket is not open");
    }
    this.socket.send(data);
  }

  close(code = 1000, reason = "") {
    if (this.readyState >= WorkerLoopbackWebSocket.CLOSING) return;
    this.readyState = WorkerLoopbackWebSocket.CLOSING;
    this.socket?.close(code, reason);
  }
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}

async function makeTicket(documentId: string): Promise<string> {
  const claims = {
    sub: "10000000-0000-4000-8000-000000000001",
    documentId,
    projectId: "20000000-0000-4000-8000-000000000002",
    role: "member",
    exp: Math.floor(Date.now() / 1000) + 60,
  };
  const payload = base64Url(encoder.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.COLLAB_TICKET_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + base64Url(signature);
}

function waitForSync(create: (onSynced: () => void, onFailure: (reason: string) => void) => HocuspocusProvider) {
  return new Promise<{ provider: HocuspocusProvider; synced: () => void }>((resolve, reject) => {
    let provider: HocuspocusProvider;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error("Timed out waiting for Hocuspocus initial sync"));
    }, 10_000);
    provider = create(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ provider, synced: () => undefined });
      },
      (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Hocuspocus authentication failed: " + reason));
      },
    );
  });
}

describe("AZ collaboration WebSocket transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("synchronizes edits between two independent Hocuspocus clients", async () => {
    vi.stubGlobal("WebSocket", WorkerLoopbackWebSocket);
    const documentId = "30000000-0000-4000-8000-000000000003";
    const token = await makeTicket(documentId);
    const firstDoc = new Y.Doc();
    const secondDoc = new Y.Doc();

    const createProvider = (document: Y.Doc) => (
      onSynced: () => void,
      onFailure: (reason: string) => void,
    ) => new HocuspocusProvider({
      url: "ws://az-collaboration/collab/" + documentId,
      name: documentId,
      document,
      token,
      onSynced: ({ state }) => { if (state) onSynced(); },
      onAuthenticationFailed: ({ reason }) => onFailure(reason),
    });

    const first = await waitForSync(createProvider(firstDoc));
    const second = await waitForSync(createProvider(secondDoc));

    try {
      firstDoc.getText("content").insert(0, "AZ real-time collaboration");
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (secondDoc.getText("content").toString() === "AZ real-time collaboration") {
            secondDoc.off("update", check);
            clearTimeout(timeout);
            resolve();
          }
        };
        const timeout = setTimeout(() => {
          secondDoc.off("update", check);
          reject(new Error("The second client did not receive the first client's edit"));
        }, 5_000);
        secondDoc.on("update", check);
        check();
      });
      expect(secondDoc.getText("content").toString()).toBe("AZ real-time collaboration");
    } finally {
      first.provider.destroy();
      second.provider.destroy();
      firstDoc.destroy();
      secondDoc.destroy();
    }
  }, 20_000);
});
