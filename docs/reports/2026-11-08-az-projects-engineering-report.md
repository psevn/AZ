# AZ Projects — engineering report (Claude, 2026-11-08)

Scope: branch `fix/az-projects-collaboration-p0` @ 761aa9e (PR #1, draft, base `feature/az-projects-mvp`), plus the live Supabase project as of today.
Method: read every changed file; read the live catalog and ran **rolled-back** runtime tests on the live database (nothing applied by this review); read the GitHub Actions results of the branch.
**Not possible from my session:** `npm install`, `npm run build`, `npm test` (the npm registry is blocked by this environment's network policy, 403 — reported, not bypassed). Nothing below claims a test result that was not observed; CI results are quoted from GitHub Actions.

## 1. Verified state (evidence)

| Area | Status | Evidence |
|---|---|---|
| Web app type-check + build | **passes in CI** | latest run: job `build` = success |
| Collaboration Worker: dependency install | **FAILS in CI on every run** (8/8 recent runs) | `npm install` → `Cannot read properties of null (reading 'edgesOut')` (npm 10.9.9); the package has no lockfile |
| Collaboration Worker tests (Workers runtime + Yjs) | **never executed** | blocked by the install failure; the docs say the same ("Not yet verified") |
| Tiptap / Yjs / Hocuspocus in the web app | **absent** | root `package.json` has only react, react-dom, supabase-js; `ProjectWorkspace` still renders "COLLABORATIVE EDITOR IN PROGRESS" |
| Worker ↔ web app link | **absent** | nothing in `src/` calls `/ticket` or opens a WebSocket |
| Invitation Edge Function + `accept_project_invitation` | written, **not deployed, migration not applied** (as instructed) | live DB has no `accept_project_invitation`; function never invoked |
| Project tables, RLS, isolation | **works on live** | rolled-back test: 2nd user sees 0 projects/members/tasks/docs/activity, cannot self-join or self-promote, anon blocked |
| `create_project` RPC | **was broken for every user** — fixed on live by Claude (migration `20261108153310`, in branch `audit/live-schema-tests`) | INSERT…RETURNING hit the SELECT policy before the creator was a member. The branch still contains the broken version in `20261108134005`; the fix migration must travel with the branch |
| Migration files vs live | **3 of the project migrations are missing from the repo** | live has `az_projects_foundation_and_unified_planning`, `az_projects_policy_and_index_hardening`, `az_projects_planning_deadline_title`; the repo has none of them, so the project schema cannot be rebuilt from Git |

Honest summary: what exists is a security-minded **scaffold** (ticket issuing, HMAC ticket, Durable Object ↔ Hocuspocus bridge, invitation flow). The user-visible goal — two members editing the same document live — is **0% delivered**: no editor in the UI, no provider, no running test of the transport.

## 2. Risks and defects found (by severity)

**P0 — blocks the goal**
1. Worker never installs in CI (npm arborist crash, no lockfile, several exact-pinned versions that I cannot verify from here: `@cloudflare/vitest-plugin@1.6.0`, `wrangler@4.158.0`, `vitest@~4.1.0`, `@hocuspocus/server@4.1.0`). Until this is green nothing about the Worker is proven.
2. Hocuspocus ↔ Durable Object adapter is unproven. Hocuspocus 4's documented API is `handleConnection(WebSocketLike, Request)`; the release notes say nothing about the returned object (`handleMessage/handleClose` used here), Durable Objects or hibernation. Needs a real two-client test.
3. Editor, provider and UI are not built (see table).
4. Migration history is incomplete in Git (3 missing + version mismatch `20261105153306` live vs `20261105160000` file).

**P1 — security, must fix before any deployment**
5. **No real revocation.** A removed member keeps editing until the 15-minute ticket expires; and expiry is only checked when a message arrives. Required by the brief ("handle removal while a connection is open").
6. **Invitation by e-mail can be hijacked if e-mail is unconfirmed.** The Edge Function compares `user.email` with the invited address but never checks `email_confirmed_at`. If the project allows unconfirmed sign-ups, anyone can register with the invitee's address and accept. (Check the Supabase Auth setting "Confirm email".)
7. Edge Function CORS **fails open**: with `APP_ORIGIN` unset the function answers `Access-Control-Allow-Origin: *`. Bearer auth limits the impact, but this should fail closed.
8. `create_project` (as in the branch) is broken (fixed on live, see above).
9. Presence identity is client-controlled: Yjs awareness (name/colour shown next to cursors) is not overwritten from the verified ticket, so a member can impersonate another member's name. Server must set it.
10. No document-size / connection limits: any member can grow a document without bound (SQLite-backed Durable Object value cap is 8 MB per Cloudflare's limits page; a full-state `put` above it would fail and silently stop persisting) or open unlimited sockets. Add a size cap, max connections per user/doc, and surface store failures to clients.
11. `private.is_project_member(project, user)` is executable by `authenticated` with an arbitrary user id: a user who knows a project id can probe whether another user is a member (low severity).
12. Invitation token (bearer secret) lives in the URL and `sessionStorage`; it stays in the address bar if acceptance fails. Add `Referrer-Policy: no-referrer` on hosting and strip the token from the URL immediately.
13. No cap on members per project; invitations limited only to 20/day per creator.

**P2 — quality**
14. `functions.invoke` errors surface as the generic "Edge Function returned a non-2xx status code", hiding the specific, already-localised server messages.
15. Standard (non-hibernating) WebSockets keep a Durable Object alive while connected: fine for a PoC, a cost/limit review is needed before launch (billing numbers are **[VERIFY]**).
16. Workers tests are smoke tests only (health, 404, DO instantiation); persistence tests are pure Yjs and never touch the Durable Object.
17. CI installs the Worker with `npm install` (no lockfile) → non-reproducible.
18. Cloudflare plan: SQLite-backed Durable Objects are available on the Workers **Free** plan (per Cloudflare's limits page, fetched today); Free has 1 GB per object / 5 GB per account. Real usage cost still **[VERIFY]**.

## 3. Decisions of the owner I would **keep**
- Native AZ document as the canonical collaborative document (DOCX/PDF stay attachments).
- Tiptap + Yjs (CRDT) with Yjs binary as the only source of truth.
- One Durable Object per document; deterministic id.
- Short-lived HMAC ticket instead of putting the Supabase JWT in the WebSocket.
- Supabase stays the authority for membership; the Worker never holds a service-role key.

## 4. One decision I would **change** (evidence-based)
Revocation: do **not** rely on ticket expiry or on the client re-fetching. Recommended mechanism, no service key in the Worker: the Durable Object runs an **alarm every 60 s** that asks a small Supabase Edge Function (`collab-membership`, authenticated with a shared secret) whether each connected `(user, project)` is still a member, and closes the sockets of removed users with a close code the client handles. Ticket lifetime drops to ~2 minutes (refreshed by the client). Removal through the app additionally calls the Worker's `/revoke` for an instant cut-off. Trade-off: up to 60 s window in the worst case, stated explicitly; cost = one cheap query per document per minute.

## 5. Execution plan (small, reviewable steps; nothing merged to `main`, nothing deployed, no migration applied to the live DB)

Work branch: `fix/az-projects-claude-p0` (based on PR #1's head; PR to `fix/az-projects-collaboration-p0`). CI (`fix/**`) is my test runner because I cannot run npm.

1. **Make the Worker installable and tested in CI** (P0-1): get a deterministic lockfile (generated by a CI job and committed, not hand-edited), pin to versions that exist, run Worker tests in CI. Report the real outcome.
2. **Prove the transport** (P0-2): in the Workers runtime, two Hocuspocus clients on one document converge; persistence survives Durable Object eviction; non-member / expired ticket rejected.
3. **Server hardening** (P1-5,9,10): revocation alarm + `/revoke`, awareness identity from ticket, document size cap, connection limits.
4. **Database** (Claude's area): reproduce the project schema from the live catalog into the local test replica, add isolation + invitation tests, add the `create_project` fix, member cap and `is_project_member` tightening as migrations (files only; applying them is your decision).
5. **Edge Function hardening** (P1-6,7,13; P2-14).
6. **Web app**: add Tiptap + Yjs + Hocuspocus provider (lockfile via step 1's mechanism), wire into `ProjectWorkspace`, presence list, connection/saving states, RTL/LTR/mixed content, mobile.
7. **Real two-user test** against the local Worker runtime (and later Playwright with two browser contexts).
8. **Deployment checklist** for you to approve (secrets, `APP_ORIGIN`, Cloudflare plan check, Supabase Auth "confirm email").

## 6. Questions for the owner (not blocking step 1–2)
- Is "Confirm email" enabled in Supabase Auth? (decides whether P1-6 is exploitable today)
- Acceptable revocation window for a removed member: 60 s (recommended) or instant-only?
