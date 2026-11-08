# AZ collaboration Worker (proof of concept)

This package is intentionally isolated from the AZ web app. It is not deployed and is not yet connected to the ProjectWorkspace UI.

## Responsibilities

- `POST /ticket`: validates a Supabase access token, resolves the primary project document, checks current project membership under the user's RLS permissions, and issues a short-lived signed collaboration ticket.
- `GET /collab/:documentId` (WebSocket upgrade): routes one document UUID to one Durable Object.
- `CollaborativeDocument`: bridges Cloudflare WebSockets to Hocuspocus v4 and persists Yjs binary state in Durable Object storage.
- Tests run through Cloudflare's Workers Vitest integration with shared storage and a single worker to support Durable Object WebSockets. Coverage includes Worker health/routing, Durable Object instantiation, Yjs binary round-trip, CRDT merge convergence, and a new two-provider test for live text sync, awareness presence, and recovery after forced Durable Object eviction. The new end-to-end test is authored but has not yet passed CI.

The browser must pass the returned ticket through the Hocuspocus provider's `token` option. The Supabase access token itself is never placed in the WebSocket URL.

## Local setup

1. From this folder run `npm install`.
2. Configure local secrets in `.dev.vars` (all three names are declared in `wrangler.jsonc`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `COLLAB_TICKET_SECRET` — use a random secret of at least 32 characters.
   - Keep `.dev.vars` out of Git.
3. For a future Cloudflare deployment, set each required value with `npx wrangler secret put <NAME>`; do not place secret values in `wrangler.jsonc`.
4. Run `npm run typecheck`, `npm test`, then `npm run dev`.
5. The local app origin defaults to `http://localhost:5173`. Set `APP_ORIGIN` to the exact deployed AZ origin before any non-local deployment.

Example local `.dev.vars` (never commit real values):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
COLLAB_TICKET_SECRET=replace-with-a-random-secret-at-least-32-characters
APP_ORIGIN=http://localhost:5173
```

## Security and current limitations

- Supabase membership is checked before issuing each ticket. The ticket is bound to one document and expires after 15 minutes.
- Expired tickets are rejected on inbound document messages and awareness updates. An idle socket may remain physically open until it sends data or disconnects; this is not immediate revocation. This is a bounded-session safeguard, **not immediate membership revocation**. A production rollout must add and test a server-side revocation mechanism that closes active sessions promptly when a member is removed.
- This first transport uses standard accepted Durable Object WebSockets. It does not use the Hibernation API; hibernation compatibility is unproven.
- No service-role key is used. The membership queries use the user's Supabase JWT and rely on the existing RLS policies.
- Yjs state is persisted as binary updates. Do not replace it with HTML/JSON as the collaboration source of truth.
- The Worker is not deployed, and no production Supabase migration has been applied.

## Next acceptance work

- Verify Supabase RLS permits a member to select their own primary project document and membership row, while blocking non-members.
- Run two independent Hocuspocus providers against the local Wrangler/DO runtime and prove WebSocket convergence, persistence after eviction/restart, and reconnect recovery.
- Add membership revocation and test that removed members lose access to existing sockets.
- Only then wire the provider and Tiptap editor into AZ's existing ProjectWorkspace UI.
