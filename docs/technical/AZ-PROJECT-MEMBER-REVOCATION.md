# AZ Projects — member removal and collaboration-session revocation

## Security contract

Removing a project member is a server-side operation. Browser clients must not delete rows from
`public.project_members` directly. The project lead calls the `project-members` Edge Function,
which authenticates the caller, checks the project and target membership, and asks the collaboration
Worker to revoke the target user's sessions for every project document.

Removal uses two database phases to close the ticket-issuance race:

1. The service-role-only `begin_project_member_removal` RPC locks and validates the project and
   membership rows, then sets `project_members.revoked_at`. The RLS membership helpers exclude
   revoked rows immediately, and the Worker ticket endpoint only issues tickets for rows where
   `revoked_at IS NULL`.
2. The Edge Function asks the Worker to revoke the target user's sessions for every project
   document. Only after every document acknowledges does it call the service-role-only
   `remove_project_member` RPC, which rechecks the active lead and target row, deletes the
   membership, and writes the `member_removed` audit event atomically.

If a Worker request fails, the row remains marked revoked: the member has already lost database
RLS access and cannot obtain another collaboration ticket. The lead can retry the removal from the
workspace; the pending row remains visible to the lead until final deletion. A fresh invitation can
reactivate a revoked member by clearing `revoked_at` only after valid invitation acceptance.

## Worker revocation protocol

- `POST /internal/revoke` is a private server-to-server endpoint. It requires
  `Authorization: Bearer <COLLAB_REVOKE_SECRET>` and a document, project, and user UUID.
- The Worker routes the request to the Durable Object bound to that document.
- The Durable Object persists a revocation timestamp scoped to `projectId:userId`, then closes
  only live Hocuspocus connections whose authenticated context matches both values.
- Ticket claims include `iatMs`. Ticket issuance also requires an active membership
  (`revoked_at IS NULL`). Authentication, document messages, and awareness updates compare the
  ticket issue time with the stored revocation timestamp. A ticket issued before revocation cannot
  reconnect or continue sending updates.
- A newly issued ticket after a successful re-invitation has a later `iatMs` and can be accepted
  after the current membership check succeeds.

The revocation timestamp is stored in Durable Object storage, so it survives object eviction and
restart. Revocation is document-scoped; the Edge Function enumerates all project documents.

## Required secrets

Configure these server-side only, using independent high-entropy values:

- Cloudflare Worker: `COLLAB_REVOKE_SECRET`
- Supabase Edge Function `project-members`: `COLLAB_REVOKE_URL` and
  `COLLAB_REVOKE_SECRET`
- Existing Worker secrets remain required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
  `COLLAB_TICKET_SECRET`.

The Worker and Edge Function revocation secrets must match. Never expose them to browser code,
commit them to the repository, or reuse the collaboration ticket-signing secret.

## Failure behavior

The Edge Function marks the membership revoked before contacting the Worker. If a Worker
request fails, the row remains revoked and the lead can retry; the member does not regain RLS access
or ticket issuance during the retry window. If the final database RPC fails after session revocation,
the row remains revoked. A valid new invitation can reactivate it later.

## Deployment order (future, approval required)

When this change is eventually approved for deployment, apply the reviewed database migrations
through `20261116140000_project_member_revocation_fence.sql` before deploying the updated Worker,
Edge Function, or frontend. Then configure the matching Worker/Edge Function revocation secret and
the Edge Function's Worker URL. Do not deploy only one side of the protocol: the database fence,
ticket filter, and revocation endpoint are a coordinated security boundary.

## Verification and deployment boundary

The Worker unit test covers authorization of the internal endpoint. The Worker integration test
covers targeted active-connection closure, unaffected collaborator continuity, and rejection of the
removed member's old ticket. The disposable PostgreSQL contract test covers direct-delete denial,
the service-role-only removal RPC, and the audit event.

These changes are source-only. Do not deploy the Worker or Edge Function, set live secrets, or apply
the migration to the connected Supabase project until reviewed and explicitly approved.
