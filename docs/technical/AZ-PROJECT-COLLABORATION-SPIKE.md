# AZ Projects — collaborative document technical spike

Status: proposed implementation target; proof of concept required before production deployment.
Date: 2026-11-08
Branch: `fix/az-projects-collaboration-p0`

## Goal

Deliver one primary project document that multiple authorized AZ members can edit concurrently, with visible presence/cursors, autosave, reconnect recovery, and durable Yjs state. The native AZ document is the canonical working copy; arbitrary DOCX/PDF/PPTX binaries are attachments, not live collaborative documents.

## Selected spike direction

- Editor: Tiptap rich-text editor with the Yjs Collaboration extension.
- Shared document model: Yjs CRDT; never synchronize the full HTML value on every keystroke.
- Collaboration protocol/server: Hocuspocus v4. Its v4 release supports Cloudflare Workers and exposes `handleConnection()` for custom WebSocket transports.
- Coordination: one Cloudflare Durable Object per primary project document, addressed deterministically by the document UUID.
- Durable state: Durable Object SQLite stores Yjs binary updates/snapshots. Persist and reload `Uint8Array` Yjs state; JSON/HTML is only a derived display/export representation and must not become the CRDT source of truth.
- Identity: Supabase Auth JWT. The collaboration server validates the token and checks membership against the primary `project_documents` row before allowing a connection.
- Relational metadata, project membership, task assignments, and activity remain in Supabase Postgres.

## Important transport caveat

Hocuspocus v4's cross-runtime support does not, by itself, prove a correct Durable Object adapter. A custom adapter must bridge Cloudflare's WebSocket lifecycle to Hocuspocus `handleConnection()`, `handleMessage()`, and `handleClose()`.

Cloudflare recommends the Hibernation WebSocket API for idle Durable Object rooms. However, the adapter must preserve Hocuspocus connection state across hibernation. Do not claim hibernation support until a test proves it. A standard non-hibernating WebSocket adapter may be used only for the local proof of concept; production cost and connection limits must be reviewed before deployment.

## Authentication and authorization contract

1. The browser obtains the current Supabase access token and passes it as the Hocuspocus connection token.
2. The Worker validates the token against Supabase Auth.
3. The Worker resolves the document UUID to a primary project document and verifies the user is a current project member.
4. Only a valid member may connect; no project/document UUID is treated as authorization.
5. The server stores verified `userId`, `projectId`, and role in server-side connection context. Client awareness data may provide display preferences, but never authorization.
6. Membership revocation must close active collaboration connections promptly. The spike must test the chosen revocation mechanism; a page refresh-only permission check is insufficient.
7. Never put Supabase service-role credentials in the browser or in a public worker response.

## Persistence contract

- `onLoadDocument` returns the previously stored Yjs binary update, or a new empty Y.Doc for a first-time document.
- `onStoreDocument` stores the current encoded Yjs state in Durable Object SQLite.
- Store writes must be awaited and failures must be surfaced; never report a document as saved before durable storage succeeds.
- Test recovery after a forced Worker/DO restart and after a client reconnect.
- Define snapshot/checkpoint retention and compaction only after the update persistence path is proven.
- Keep document metadata in Supabase; keep high-frequency CRDT state in the document's Durable Object storage.

## Proof-of-concept acceptance tests

- [ ] One authenticated member opens the primary document and edits formatted text.
- [ ] Two different project members edit simultaneously; both clients converge to the same Yjs state without lost updates.
- [ ] Presence list and cursor/selection indicators show the other editor.
- [ ] A non-member cannot connect even when given a valid document UUID.
- [ ] A member removed from the project loses access to the active collaboration session within the agreed revocation window.
- [ ] A document reload restores the latest persisted content.
- [ ] A temporary network interruption reconnects and merges local unsynced changes without overwriting peer edits.
- [ ] A forced DO restart does not lose acknowledged/saved edits.
- [ ] Arabic RTL, English LTR, and mixed-direction paragraphs behave correctly.
- [ ] Keyboard navigation, reduced-motion preferences, and narrow mobile widths remain usable.
- [ ] Automated tests run two independent clients against the real local Worker/DO runtime.

## Implementation sequence

1. Build the isolated Worker/DO transport spike and prove the Hocuspocus adapter.
2. Add durable Yjs binary persistence and restart/reconnect tests.
3. Add Supabase JWT verification and project membership checks.
4. Add Tiptap editor and provider dependencies to the AZ frontend, updating `package-lock.json` with npm rather than hand-editing it.
5. Replace the current editor-in-progress placeholder only after the provider passes the two-client test.
6. Add collaborator presence, cursor styling, saving/connection states, and Arabic/English RTL/LTR coverage.
7. Deploy only after the acceptance tests pass and the owner approves the Cloudflare/Supabase deployment.


## Current implementation snapshot — 2026-11-08

An isolated Worker proof-of-concept scaffold now exists under `collaboration-worker/`:

- `POST /ticket` validates the Supabase access token, resolves the primary project document, checks project membership with the caller's JWT/RLS, and issues a 15-minute HMAC-signed ticket.
- `GET /collab/:documentId` routes the document to a Durable Object.
- The Durable Object bridges Cloudflare WebSockets to Hocuspocus v4 and stores encoded Yjs state in Durable Object storage.
- The browser's Supabase access token is sent only to the ticket endpoint; the WebSocket provider receives the scoped ticket instead.
- A separate CI type-check job was added for this package.

**Not yet verified:** npm dependency installation, TypeScript compilation, local Wrangler runtime, two-client convergence, persistence after DO restart, reconnect recovery, Supabase RLS compatibility, and active-session revocation. No deployment has occurred. The current session expiry is a 15-minute upper bound; it is not immediate revocation. The current adapter uses standard WebSockets, not the Hibernation API.

The scaffold must not be integrated into the production editor until the acceptance tests above pass. The AZ frontend dependencies and lockfile have intentionally not been changed yet.

## References

- Hocuspocus v4 release notes: https://github.com/ueberdosis/hocuspocus/blob/main/RELEASE_NOTES_V4.md
- Hocuspocus persistence guide: https://tiptap.dev/docs/hocuspocus/guides/persistence
- Hocuspocus hooks: https://tiptap.dev/docs/hocuspocus/server/hooks
- Cloudflare Durable Objects WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare Durable Objects SQLite storage: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
