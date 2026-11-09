# AZ Projects — collaborative document technical spike

Status: implementation is integrated on an isolated draft branch; browser, authorization, revocation, and production acceptance remain open.
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
4. Add Tiptap editor and provider dependencies to the AZ frontend, updating `package-lock.json` with npm rather than hand-editing it. **Implemented.**
5. Replace the editor-in-progress placeholder with the Tiptap/Yjs editor after the Worker passes the two-client transport test. **Implemented in the branch; browser verification remains open.**
6. Add collaborator presence, cursor styling, connection/sync states, and Arabic/English direction support. **Implemented in the branch; visual browser verification remains open.**
7. Deploy only after the acceptance tests pass and the owner approves the Cloudflare/Supabase deployment.


## Current implementation snapshot — 2026-11-08

The isolated Worker and the AZ frontend editor are now connected at the code level on `fix/az-projects-collaboration-p0`:

- `POST /ticket` validates the Supabase access token, resolves the primary project document, checks membership with the caller's JWT/RLS, and issues a 15-minute HMAC-signed ticket.
- `GET /collab/:documentId` routes the document to a Durable Object.
- The Durable Object bridges Cloudflare WebSockets to Hocuspocus v4 and persists encoded Yjs binary state.
- `src/components/ProjectCollaborativeEditor.tsx` uses Tiptap, Yjs Collaboration, CollaborationCaret, Supabase Auth, and the Worker ticket endpoint. It displays connection/sync state and collaborator presence, refreshes its short-lived ticket before expiry, and uses automatic Yjs synchronization rather than replacing the whole HTML document.
- `ProjectWorkspace` now lazy-loads the collaborative editor when the primary document tab is opened. The root environment variable `VITE_AZ_COLLABORATION_URL` points to the Worker origin.
- The invitation migration now includes the `member_invited` event in the `project_activity` check constraint. This was dry-run inside a transaction and rolled back; no live migration was applied.
- CI run #241 passed the root AZ type-check and Vite production build, Worker TypeScript checks, Worker health/routing and DO smoke tests, `POST /ticket` tests with mocked Supabase Auth/document/membership responses, Yjs binary persistence and CRDT merge tests, a real two-client WebSocket integration test, and the PostgreSQL 17 project migration/RLS contract.

**What the passing tests do not prove:** the `POST /ticket` tests use mocked Supabase responses, not live Supabase Auth/RLS. The WebSocket integration test creates a test-signed ticket and exercises `/collab/:documentId`; it does not test the browser UI or simultaneous conflicting edits through the full Tiptap editor. Forced Durable Object eviction/restart and active membership revocation remain untested.

**Remaining production blockers:**
- Verify the complete browser flow against a local Worker and the AZ Supabase project.
- Verify RLS for project documents and membership rows with both member and non-member accounts.
- Implement and test prompt revocation of active WebSocket sessions when a member is removed. The current 15-minute ticket expiry is not immediate revocation; idle sockets can remain connected.
- Test recovery after forced Durable Object eviction/restart. Current passing test covers client disconnect/reconnect only.
- Verify Arabic RTL, English LTR, mixed-direction paragraphs, accessibility, and mobile behavior in a browser.
- Eleven older historical migration files remain missing from Git. The four AZ Projects migration sources have schema-equivalent reconstructions, but a clean database rebuild remains blocked until the remaining sources are recovered.
- The adapter uses standard accepted WebSockets, not the Hibernation API. Cost, connection limits, and hibernation compatibility remain unverified.

No Worker deployment has occurred, no live Supabase migration has been applied, and the draft PR remains targeted at `feature/az-projects-mvp`, not `main`.
## References

- Hocuspocus v4 release notes: https://github.com/ueberdosis/hocuspocus/blob/main/RELEASE_NOTES_V4.md
- Hocuspocus persistence guide: https://tiptap.dev/docs/hocuspocus/guides/persistence
- Hocuspocus hooks: https://tiptap.dev/docs/hocuspocus/server/hooks
- Cloudflare Durable Objects WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare Durable Objects SQLite storage: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
