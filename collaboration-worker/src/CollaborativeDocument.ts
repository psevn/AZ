import { Hocuspocus, type WebSocketLike } from "@hocuspocus/server";
import { encodeYjsDocument, restoreYjsDocument } from "./yjsPersistence";

interface TicketClaims {
  sub: string;
  documentId: string;
  projectId: string;
  role: string;
  exp: number;
}

const decoder = new TextDecoder();

function assertLiveContext(context: unknown): asserts context is { userId: string; projectId: string; ticketExpiresAt: number } {
  const claims = context as { userId?: string; projectId?: string; ticketExpiresAt?: number } | undefined;
  if (!claims?.userId || !claims.projectId) throw new Error("AUTH_REQUIRED");
  if (!claims.ticketExpiresAt || claims.ticketExpiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("TICKET_EXPIRED");
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyTicket(token: string, secret: string): Promise<TicketClaims> {
  if (!secret || secret.length < 32) throw new Error("COLLABORATION_SECRET_NOT_CONFIGURED");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("INVALID_TICKET");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload));
  if (!valid) throw new Error("INVALID_TICKET");
  const claims = JSON.parse(decoder.decode(decodeBase64Url(payload))) as TicketClaims;
  if (!claims.sub || !claims.documentId || !claims.projectId || !claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("TICKET_EXPIRED");
  }
  return claims;
}

export class CollaborativeDocument {
  private readonly hocuspocus: Hocuspocus;
  private documentId = "";

  constructor(
    private readonly state: DurableObjectState,
    env: Env,
  ) {
    const room = this;
    this.hocuspocus = new Hocuspocus({
      quiet: true,
      debounce: 1000,
      maxDebounce: 5000,
      async onAuthenticate({ token, documentName }) {
        const claims = await verifyTicket(token, env.COLLAB_TICKET_SECRET);
        if (claims.documentId !== documentName || claims.documentId !== room.documentId) throw new Error("DOCUMENT_MISMATCH");
        return {
          userId: claims.sub,
          projectId: claims.projectId,
          role: claims.role,
          ticketExpiresAt: claims.exp,
        };
      },
      async onLoadDocument({ documentName }) {
        if (documentName !== room.documentId) {
          // The worker routes one stable document UUID to one Durable Object.
          // The UUID check is repeated here so the room cannot load another doc.
          throw new Error("DOCUMENT_MISMATCH");
        }
        const saved = await state.storage.get<Uint8Array>("yjs-state");
        return restoreYjsDocument(saved);
      },
      async onStoreDocument({ document, documentName }) {
        if (documentName !== room.documentId) throw new Error("DOCUMENT_MISMATCH");
        const update = encodeYjsDocument(document);
        await state.storage.put("yjs-state", update);
        await state.storage.put("saved-at", new Date().toISOString());
      },
      async beforeHandleMessage({ context }) {
        assertLiveContext(context);
      },
      async beforeHandleAwareness({ context }) {
        assertLiveContext(context);
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      if (new URL(request.url).pathname.endsWith("/health")) {
        return Response.json({ status: "ready", document: this.documentId || "unbound" });
      }
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const pathMatch = new URL(request.url).pathname.match(/^\/collab\/([0-9a-f-]{36})$/i);
    if (!pathMatch) return new Response("Invalid document route", { status: 400 });
    this.documentId = pathMatch[1].toLowerCase();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const connection = this.hocuspocus.handleConnection(
      server as unknown as WebSocketLike,
      request,
    );

    server.addEventListener("message", async (event) => {
      const data = event.data;
      const bytes = typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof Blob
          ? new Uint8Array(await data.arrayBuffer())
          : new Uint8Array(data as ArrayBuffer);
      connection.handleMessage(bytes);
    });

    server.addEventListener("close", (event) => {
      connection.handleClose({ code: event.code, reason: event.reason } as CloseEvent);
    });

    server.addEventListener("error", () => {
      connection.handleClose();
      this.sockets.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
