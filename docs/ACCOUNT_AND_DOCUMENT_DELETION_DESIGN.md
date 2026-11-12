# AZ Account and Document Deletion Design

**Status:** Proposed design only — not implemented or approved for deployment  
**Date:** 2026-11-12

This document is a design/review contract. It does not authorize migrations, deployments, Supabase setting changes, or deletion of real user data.

## 1. Current architecture and problem

The current schema cascades relational rows when a document or Auth user is deleted, but PostgreSQL foreign-key cascades do not remove Supabase Storage objects. The private `documents` bucket stores each PDF at `{auth_user_id}/{document_id}.pdf`; the database checks the owner prefix. Browser Storage policies are deliberately locked, so trusted Edge Functions own signed upload/download access.

Document processing uses a row lock and processing token in `process_document_pages_atomic`. Its state checks reject actions unless the document exists in the expected state. Deletion must serialize with this workflow. Storage and PostgreSQL cannot share one atomic transaction, so cleanup must be retryable.

## 2. Security invariants

- Derive the acting user only from a bearer token verified by Supabase Auth. Never accept a target `user_id`, bucket, or storage path from the client.
- Resolve a document's canonical path from its owner-scoped database row. For account cleanup, enumerate only the exact authenticated user's folder prefix.
- Use the service-role client only inside trusted Edge Functions. Never expose it to the browser.
- Require POST, exact CORS allowlisting, bounded bodies, and per-user rate limits.
- Make transitions conditional and idempotent. Retries resume cleanup and cannot target another user's data.
- Fail closed on unknown state, owner mismatch, path mismatch, or provider/configuration failure.
- Keep user-visible states distinct: requested, in progress, completed, and failed/retry required.
- Never log bearer tokens, signed URLs, PDF text, raw provider errors, or secrets.

## 3. Individual document deletion

### Proposed state machine

`uploaded | processing | ready | failed` → `deleting` → relational row removed

A migration would extend the document status constraint with `deleting`. A service-role-only RPC would lock the row `FOR UPDATE`, match both document ID and owner ID, set `deleting`, clear processing lock fields, and return the canonical stored path to the trusted caller.

The Edge Function would:

1. Verify JWT, rate-limit, and call the transition RPC using the Auth-derived user ID.
2. Remove the exact canonical object from the private `documents` bucket.
3. Treat an already-absent object as success only after confirming the Storage API's exact missing-object behavior; do not swallow arbitrary errors.
4. Delete the relational document row with both `id` and `user_id` predicates only after Storage cleanup is confirmed. FK cascades then remove pages, summaries, notes, quizzes, questions, attempts, and other relational children.
5. Return success only after both Storage and database deletion are confirmed.

### Concurrency and retry requirements

- If Storage removal fails, retain the `deleting` row; a retry resumes.
- If Storage succeeds but row deletion fails, retain `deleting`; retry verifies object absence then retries the row deletion.
- Upload creation, signed download URL issuance, and processing start/resume must reject a `deleting` document.
- The processing RPC already locks the document row. The deletion transition must take the same lock: a page save/complete action either commits before deletion or sees the new state and is rejected.
- Supabase documents that `createSignedUploadUrl` tokens are valid for 2 hours and can upload without further authentication. A token already issued may therefore still create the object after deletion starts. Retain a tombstone/job through the full 2-hour validity window (with clock-skew margin), then run a final prefix cleanup before declaring deletion complete. Confirm the actual token type used by the deployed SDK/version and test the behavior in disposable Staging.
- Signed download URLs currently live for 300 seconds. Already-issued URLs may remain usable until expiry; disclose this limitation and do not promise instant revocation.
- Add a bounded, service-role-only retry mechanism for rows stuck in `deleting`.

## 4. Whole-account deletion

Account deletion must be asynchronous. Do not implement it as a direct client-side Auth Admin delete.

### Durable job record

Create a private `account_deletion_jobs` table in a migration, with:
- `id` UUID primary key; `user_id` UUID not cascading to Auth (so a short-lived completion record can survive Auth deletion);
- `status` constrained to `requested | blocking_access | cleaning_storage | deleting_auth | completed | failed`;
- `requested_at`, `updated_at`, `completed_at`; non-negative `attempts`;
- a short non-sensitive `last_error_code`, never raw provider messages or user content.

Enable RLS, grant no client access, add no client policies, and allow service-role access only. Enforce one active job per user while allowing a later request after completion. Define short retention for completed records and minimize retained identifiers.

### Proposed workflow

1. **Request:** Verify JWT, derive user ID from Auth, require explicit UI confirmation, create/resume one idempotent job, and set `profiles.deletion_requested_at`.
2. **Block new work:** Prevent new sessions, uploads, signed URL issuance, page processing, quiz generation, planning writes, and project mutations. This requires an account-active guard across every Edge Function and direct-write RLS policy; checking only the deletion endpoint is insufficient.
3. **Revoke access:** Use a documented supported Auth mechanism to block new sessions and revoke refresh sessions. Test behavior for existing access tokens and upload tokens; do not assume banning invalidates every issued credential.
4. **Clean Storage:** Paginate all objects under the exact `{user_id}/` prefix in the private `documents` bucket. Remove in bounded batches and re-enumerate before declaring cleanup complete.
5. **Inventory other stores:** Check all Storage buckets, external file providers, caches, queues, analytics sinks, and provider-side retention. Current source review establishes the private `documents` bucket and relational schema only; it does not prove there are no external copies.
6. **Delete Auth user:** Only after access blocking and Storage cleanup succeed, call Auth Admin delete for the exact job user ID. Auth FK cascades remove relational rows.
7. **Verify/finalize:** Confirm Auth user is absent and Storage prefix empty. Mark job complete. If Auth deletion succeeded but finalization failed, retry must recognize the already-absent Auth user and safely finish.
8. **Report:** Return generic job ID/status. Never report completion while cleanup is pending.

### Shared AZ Projects — policy decision required

Before enabling account deletion, decide what happens if the user is a project lead or owns shared work: transfer ownership to another active member under an explicit policy, archive/delete only under a defined team policy, or block final deletion until transfer. Also define handling for memberships and assigned tasks. Do not silently delete shared project records or leave projects ownerless.

## 5. Privacy and retention disclosures

- Verify every FK/trigger in the final migration replay; relational cascades do not remove Storage objects.
- Signed download URLs already issued may remain usable for up to their current 300-second lifetime.
- Signed upload URLs are documented as valid for 2 hours; keep a tombstone and perform a final Storage prefix sweep after that window plus clock-skew margin.
- Deleting the Auth user invalidates refresh tokens but does not retroactively invalidate already-issued access JWTs; they remain valid until expiry unless sensitive operations check session existence or deletion state.
- AI provider retention, backups, infrastructure logs, and legally required records may have separate retention rules. Do not promise immediate erasure from those systems without verifying provider terms.
- Explain request accepted, cleanup pending, and completion states to the user.

## 6. Required tests before approval

### Document
- Owner deletes ready, uploaded, failed, and processing documents.
- Non-owner cannot inspect or delete by guessing UUID.
- Client-supplied path/bucket/user ID is rejected or ignored.
- Page-save/complete races deletion; one serialized outcome, no orphan rows.
- Signed URL issuance rejected after `deleting`.
- Inject failures before Storage removal, after removal, and before DB delete; retry converges.
- Previously issued upload token tested through full validity; late object creation detected and cleaned.
- Missing object distinguished from permission/network/provider errors.
- Retry is bounded, idempotent, and cannot cross owner prefixes.

### Account
- User can request only their own deletion; repeated requests resume one active job.
- New writes and Edge Function operations blocked after request transition.
- Existing access, refresh, signed download, and signed upload credentials tested for actual remaining validity.
- Storage pagination, partial removal, empty prefixes, and retries tested.
- Auth deletion happens only after Storage cleanup; retry works if finalization failed after Auth deletion.
- Two-user tests prove no cross-user enumeration/removal.
- Project lead/member policy cases tested.
- Final verification checks user-owned relational rows and Storage objects within the defined scope.

## 7. Rollout gates

1. Approve project ownership and user-facing deletion policy.
2. Verify current official Supabase behavior for Storage list/remove, signed-upload expiry, Auth deletion/session revocation, and JWT expiry using disposable tests. The current docs state: signed upload URLs are valid for 2 hours; Storage objects must be removed through the Storage API (not SQL), with up to 1,000 objects per remove call; Auth deletion invalidates refresh tokens but already-issued access JWTs remain valid until expiry.
3. Implement schema/RPC in a separate migration PR.
4. Implement document deletion first with fault-injection tests.
5. Implement account deletion only after active-account guards cover all write paths and direct-write RLS.
6. Run clean migration replay and full tests against disposable local PostgreSQL/Supabase.
7. Obtain independent security review and separately approved staging rollout.
8. Do not deploy to Production before staging and recovery procedures are accepted.

## 8. Current implementation status

No document/account deletion Edge Function was found in the reviewed inventory. `profiles.deletion_requested_at` exists but no complete consumer was found. Relational FK cascades do not clean Storage. This document is design only: no endpoint, migration, scheduler, Auth action, Storage removal, or live data change was performed.
