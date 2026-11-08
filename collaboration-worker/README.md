# AZ Projects collaboration Worker

This package contains the isolated Cloudflare Worker and Durable Object transport used by the AZ Projects shared-document editor. The React ProjectWorkspace now mounts the Tiptap editor and connects through this Worker, but the Worker is not deployed and browser integration against the live Supabase project has not yet been completed.

## Responsibilities

- `POST /ticket`: validates a Supabase access token, resolves the primary project document, checks current project membership under the user's RLS permissions, and issues a short-lived signed collaboration ticket.
- `GET /collab/:documentId` (WebSocket upgrade): routes one document UUID to one Durable Object.
- `CollaborativeDocument`: bridges Cloudflare WebSockets to Hocuspocus v4 and persists Yjs binary state in Durable Object storage.
- The AZ web app uses Tiptap, Yjs Collaboration, and CollaborationCaret for rich-text editing, remote presence, and cursor display.
- Unit tests run through Cloudflare's Workers Vitest integration. A separate Node.js integration suite uses Wrangler's `createTestHarness()` to launch the actual Worker build and connect two independent Hocuspocus clients over real WebSockets. It verifies text propagation, awareness presence, and reconnect recovery.

The browser sends its current Supabase access token only to `POST /ticket`; the WebSocket provider receives a scoped short-lived ticket. The Supabase access token is never placed in the WebSocket URL.

## Local setup

1. In the repository root, create `.env.local` and set:
   `VITE_AZ_COLLABORATION_URL=http://127.0.0.1:8787`
2. From this folder run `npm install`.
3. Configure local secrets in `.dev.vars` (all three names are declared in `wrangler.jsonc`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `COLLAB_TICKET_SECRET` — use a random secret of at least 32 characters.
   - Keep `.dev.vars` out of Git.
4. Start the Worker with `npm run dev` in this folder.
5. In a second terminal, start the AZ web app from the repository root with `npm run dev`.
6. For a future Cloudflare deployment, set each required value with `npx wrangler secret put <NAME>`; do not place secret values in `wrangler.jsonc`.
7. Set `APP_ORIGIN` to the exact deployed AZ origin before any non-local deployment.

Example local Worker `.dev.vars` (never commit real values):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
COLLAB_TICKET_SECRET=replace-with-a-random-secret-at-least-32-characters
APP_ORIGIN=http://localhost:5173
```

## Security and current limitations

- Supabase membership is checked before issuing each ticket. The ticket is bound to one document and expires after 15 minutes. The frontend refreshes its ticket before expiry.
- Expired tickets are rejected on inbound document messages and awareness updates. An idle socket may remain physically open until it sends data or disconnects; this is not immediate revocation. A production rollout must add and test server-side revocation that closes active sessions promptly when a member is removed.
- This first transport uses standard accepted Durable Object WebSockets. It does not use the Hibernation API; hibernation compatibility is unproven.
- No service-role key is used. Membership queries use the user's Supabase JWT and rely on existing RLS policies.
- Yjs state is persisted as binary updates. Do not replace it with HTML/JSON as the collaboration source of truth.
- The new invitation migration also extends the `project_activity` event constraint to allow `member_invited`; this migration has only been dry-run and is not applied to the live database.
- The live Supabase migration history contains project foundation migrations whose corresponding SQL files are currently missing from this Git repository. Recover and commit those migration sources before attempting a clean environment rebuild or production deployment.
- The Worker is not deployed, and no production Supabase migration has been applied.

## CI verification

The latest CI run passed:
- Root AZ TypeScript check and Vite production build.
- Worker TypeScript checks.
- Worker routing/health and Durable Object smoke tests.
- Yjs binary persistence and concurrent CRDT merge tests.
- Real two-client WebSocket text sync, awareness presence, and reconnect recovery using Wrangler's Worker test harness.

The end-to-end test creates a test-signed ticket and exercises the `/collab/:documentId` route. It does **not** yet exercise `POST /ticket`, live Supabase Auth/RLS, browser rendering, forced Durable Object eviction/restart, or membership revocation.

## Next acceptance work

- Test the full browser flow against a local Worker and the AZ Supabase project.
- Verify Supabase RLS permits a member to select their own primary project document and membership row, while blocking non-members.
- Add membership revocation and test that removed members lose access to existing sockets promptly.
- Test persistence after forced Durable Object eviction/restart, not only client reconnect.
- Verify Arabic RTL, English LTR, mixed-direction text, keyboard accessibility, and mobile widths in a browser.
- Recover the missing SQL migration files from the live project history before production deployment.
- Review Durable Object cost, limits, and Hibernation API compatibility.
- Deploy only after these acceptance checks pass and the owner explicitly approves deployment and migration application.
