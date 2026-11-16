# AZ Projects — member removal and collaboration-session revocation

## Security contract

Removing a project member is a server-side operation. Browser clients must not delete rows from
`public.project_members` directly. The project lead calls the `project-members` Edge Function,
which authenticates the caller, checks the project and target membership, and asks the collaboration
Worker to revoke the target user's sessions for every project document.

The Edge Function only calls the service-role-only `remove_project_member` RPC after all document
revocation requests have been acknowledged. The RPC locks the project and both membership rows,
re-checks that the caller is still a lead, refuses self-removal and lead/creator removal, deletes the
member row, and writes the `member_removed` audit event in the same database transaction.

## Worker revocation protocol

- `POST /internal/revoke` is a private server-to-server endpoint. It requires
  `Authorization: Bearer <COLLAB_REVOKE_SECRET>` and a document, project, and user UUID.
- The Worker routes the request to the Durable Object bound to that document.
- The Durable Object persists a revocation timestamp scoped to `projectId:userId`, then closes
  only live Hocuspocus connections whose authenticated context matches both values.
- Ticket claims include `iatMs`. Authentication, document messages, and awareness updates compare
  the ticket issue time with the stored revocation timestamp. A ticket issued before revocation
  cannot reconnect or continue sending updates.
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

The Edge Function revokes sessions before removing the database membership. If a Worker request
fails, the membership row is not deleted and the function returns an error. If a later database
RPC fails after revocation, the member can still obtain a fresh ticket only while their membership
remains valid; previously issued tickets remain revoked. This ordering favors access safety over
availability.

## Verification and deployment boundary

The Worker unit test covers authorization of the internal endpoint. The Worker integration test
covers targeted active-connection closure, unaffected collaborator continuity, and rejection of the
removed member's old ticket. The disposable PostgreSQL contract test covers direct-delete denial,
the service-role-only removal RPC, and the audit event.

These changes are source-only. Do not deploy the Worker or Edge Function, set live secrets, or apply
the migration to the connected Supabase project until reviewed and explicitly approved.
