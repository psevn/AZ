import { Hocuspocus, type WebSocketLike } from "@hocuspocus/server";
import * as Y from "yjs";

interface Env {
  COLLAB_TICKET_SECRET: string;
}

interface TicketClaims {
  sub: string;
  documentId: string;
  projectId: string;
  role: string;
  exp: number;
}

const decoder = new TextDecoder();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyTicket(token: string, secret: string): Promise<TicketClaims> {
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
  private readonly sockets = new WeakMap<WebSocket, ReturnType<Hocuspocus["handleConnection"]>>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.hocuspocus = new Hocuspocus({
      quiet: true,
      debounce: 1000,
      maxDebounce: 5000,
      async onAuthenticate({ token, documentName }) {
        const claims = await verifyTicket(token, env.COLLAB_TICKET_SECRET);
        if (claims.documentId !== documentName) throw new Error("DOCUMENT_MISMATCH");
        return {
          userId: claims.sub,
          projectId: claims.projectId,
          role: claims.role,
          ticketExpiresAt: claims.exp,
        };
      },
      async onLoadDocument({ documentName }) {
        if (documentName !== state.id.toString()) {
          // The worker routes one stable document UUID to one Durable Object.
          // The UUID check is repeated here so the room cannot load another doc.
          throw new Error("DOCUMENT_MISMATCH");
        }
        const saved = await state.storage.get<Uint8Array>("yjs-state");
        return saved || new Y.Doc();
      },
      async onStoreDocument({ document, documentName }) {
        if (documentName !== state.id.toString()) throw new Error("DOCUMENT_MISMATCH");
        const update = Y.encodeStateAsUpdate(document);
        await state.storage.put("yjs-state", update);
        await state.storage.put("saved-at", new Date().toISOString());
      },
      async beforeHandleMessage({ context }) {
        if (!context?.userId || !context?.projectId) throw new Error("AUTH_REQUIRED");
        if (context.ticketExpiresAt < Math.floor(Date.now() / 1000)) throw new Error("TICKET_EXPIRED");
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      if (new URL(request.url).pathname.endsWith("/health")) {
        return Response.json({ status: "ready", document: this.state.id.toString() });
      }
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const connection = this.hocuspocus.handleConnection(
      server as unknown as WebSocketLike,
      request,
    );
    this.sockets.set(server, connection);

    server.addEventListener("message", (event) => {
      const data = event.data;
      const bytes = typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data instanceof Blob
            ? new Uint8Array([])
            : new Uint8Array(data as ArrayBuffer);
      connection.handleMessage(bytes);
    });

    server.addEventListener("close", (event) => {
      connection.handleClose({ code: event.code, reason: event.reason } as CloseEvent);
      this.sockets.delete(server);
    });

    server.addEventListener("error", () => {
      connection.handleClose();
      this.sockets.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
