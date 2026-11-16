import { Hocuspocus, type WebSocketLike } from "@hocuspocus/server";
import { DurableObject } from "cloudflare:workers";
import { encodeYjsDocument, restoreYjsDocument } from "./yjsPersistence";

interface TicketClaims {
  sub: string;
  documentId: string;
  projectId: string;
  role: string;
  exp: number;
  iatMs: number;
}

const decoder = new TextDecoder();

async function assertLiveContext(
  context: unknown,
  storage: DurableObjectStorage,
): Promise<void> {
  const claims = context as {
    userId?: string;
    projectId?: string;
    ticketExpiresAt?: number;
    ticketIssuedAtMs?: number;
  } | undefined;
  if (!claims?.userId || !claims.projectId) throw new Error("AUTH_REQUIRED");
  if (!claims.ticketExpiresAt || claims.ticketExpiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("TICKET_EXPIRED");
  }
  if (!Number.isSafeInteger(claims.ticketIssuedAtMs)) throw new Error("INVALID_TICKET");
  const revokedAtMs = await storage.get<number>(`revoked:${claims.projectId}:${claims.userId}`);
  if (typeof revokedAtMs === "number" && claims.ticketIssuedAtMs! <= revokedAtMs) {
    throw new Error("MEMBERSHIP_REVOKED");
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

export class CollaborativeDocument extends DurableObject<Cloudflare.Env> {
  private readonly hocuspocus: Hocuspocus;
  private readonly activeSockets = new Map<string, { socket: WebSocket; userId?: string; projectId?: string }>();
  private documentId = "";

  constructor(
    ctx: DurableObjectState,
    env: Cloudflare.Env,
  ) {
    super(ctx, env);
    const room = this;
    const storage = this.ctx.storage;
    this.hocuspocus = new Hocuspocus({
      quiet: true,
      debounce: 1000,
      maxDebounce: 5000,
      async onAuthenticate({ token, documentName, context }) {
        const claims = await verifyTicket(token, env.COLLAB_TICKET_SECRET);
        if (claims.documentId !== documentName || claims.documentId !== room.documentId) throw new Error("DOCUMENT_MISMATCH");
        const transportId = (context as { transportId?: string } | undefined)?.transportId;
        if (!transportId) throw new Error("SOCKET_NOT_REGISTERED");
        const activeSocket = room.activeSockets.get(transportId);
        if (!activeSocket) throw new Error("SOCKET_NOT_REGISTERED");
        activeSocket.userId = claims.sub;
        activeSocket.projectId = claims.projectId;
        const context = {
          userId: claims.sub,
          projectId: claims.projectId,
          role: claims.role,
          ticketExpiresAt: claims.exp,
          ticketIssuedAtMs: claims.iatMs,
        };
        await assertLiveContext(context, storage);
        return context;
      },
      async onLoadDocument({ documentName }) {
        if (documentName !== room.documentId) {
          // The worker routes one stable document UUID to one Durable Object.
          // The UUID check is repeated here so the room cannot load another doc.
          throw new Error("DOCUMENT_MISMATCH");
        }
        const saved = await storage.get<Uint8Array>("yjs-state");
        return restoreYjsDocument(saved);
      },
      async onStoreDocument({ document, documentName }) {
        if (documentName !== room.documentId) throw new Error("DOCUMENT_MISMATCH");
        const update = encodeYjsDocument(document);
        await storage.put("yjs-state", update);
        await storage.put("saved-at", new Date().toISOString());
      },
      async beforeHandleMessage({ context }) {
        await assertLiveContext(context, storage);
      },
      async beforeHandleAwareness({ context }) {
        await assertLiveContext(context, storage);
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const revokePrefix = "/internal/revoke/";
    const revokeMatch = url.pathname.startsWith(revokePrefix)
      ? url.pathname.slice(revokePrefix.length).match(/^[0-9a-f-]{36}$/i)
      : null;
    if (revokeMatch && request.method === "POST") {
      const secret = this.env.COLLAB_REVOKE_SECRET;
      if (!secret || secret.length < 32) return Response.json({ error: "REVOKE_NOT_CONFIGURED" }, { status: 503 });
      if (request.headers.get("authorization") !== "Bearer " + secret) {
        return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      let body: { projectId?: string; userId?: string };
      try {
        body = await request.json() as { projectId?: string; userId?: string };
      } catch {
        return Response.json({ error: "INVALID_JSON" }, { status: 400 });
      }
      const isUuid = (value: unknown): value is string =>
        typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      if (!isUuid(body.projectId) || !isUuid(body.userId)) {
        return Response.json({ error: "INVALID_REVOCATION" }, { status: 400 });
      }
      const documentId = revokeMatch[0].toLowerCase();
      this.documentId = documentId;
      const revokedAtMs = Date.now();
      await this.ctx.storage.put(`revoked:${body.projectId}:${body.userId}`, revokedAtMs);

      let closedConnections = 0;
      for (const [transportId, activeSocket] of this.activeSockets) {
        if (activeSocket.userId === body.userId && activeSocket.projectId === body.projectId) {
          activeSocket.socket.close(4003, "membership-revoked");
          this.activeSockets.delete(transportId);
          closedConnections += 1;
        }
      }
      return Response.json({ revoked: true, closedConnections });
    }

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

    const socket: WebSocketLike = {
      send: (data) => server.send(data),
      close: (code, reason) => server.close(code, reason),
      get readyState() { return server.readyState; },
    };
    const transportId = crypto.randomUUID();
    const connection = this.hocuspocus.handleConnection(socket, request, { transportId });
    this.activeSockets.set(transportId, { socket: server });

    server.addEventListener("message", (event) => {
      const data = event.data;
      if (data instanceof Blob) {
        void data.arrayBuffer().then((buffer) => {
          connection.handleMessage(new Uint8Array(buffer));
        });
        return;
      }
      const bytes = typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data as ArrayBuffer);
      connection.handleMessage(bytes);
    });

    server.addEventListener("close", (event) => {
      this.activeSockets.delete(transportId);
      connection.handleClose({ code: event.code, reason: event.reason } as CloseEvent);
    });

    server.addEventListener("error", () => {
      this.activeSockets.delete(socketId);
      connection.handleClose();
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
