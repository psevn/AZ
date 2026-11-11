# Supabase Platform Verification Checklist

**Status:** Pre-deployment test plan  
**Applies to:** AZ canonical migration baseline, AZI, AZ Projects, document storage  
**Last updated:** 2026-11-11

This checklist identifies behavior that a disposable PostgreSQL replay cannot prove. It is a release gate plan, not authorization to connect to, modify, or deploy to the live Supabase project.

## 1. Current local/CI evidence and limits

The clean replay workflow runs the committed migrations against disposable PostgreSQL 16 with local stubs for Supabase-managed services. It can validate SQL replay, schema objects, selected grants, RLS behavior for representative rows, and RPC behavior that depends only on PostgreSQL.

It does **not** reproduce the Supabase Auth service, PostgREST request pipeline, Storage API, Realtime service, Edge Runtime, pg_cron extension runtime, or the production project's migration history and configuration.

The Storage migration sequence deliberately drops all direct client policies on `storage.objects`. The current SQL test treats that as a locked-client-storage posture. Before enabling document upload/download, the product must have a verified trusted server-side Storage path or an explicitly reviewed least-privilege policy design. Do not casually restore broad client policies to make the test pass.

## 2. Required isolated Supabase staging checks

Use a separate disposable Supabase project or isolated local Supabase stack with the actual Supabase services. Do not use production credentials for these checks. Do not expose a service-role key to browser code.

### Auth and PostgREST
- Sign in as two independent test users and issue requests through the real PostgREST API using their actual JWTs.
- Confirm `auth.uid()` resolves to the expected user for each request and cannot be spoofed by request payload fields.
- Repeat cross-user read/write denial tests for subjects, tasks, documents, quizzes, quiz attempts, Planning, AZ Projects, project documents, attachments, and activity.
- Confirm unauthenticated/anon requests cannot read private user data or execute authenticated-only RPCs.
- Confirm service-role access is restricted to trusted server environments and never shipped to the client.
- Verify PostgREST exposed schemas, function discovery, schema cache refresh, and actual RPC argument/return serialization.

### Storage API
- **Known implementation mismatch (release blocker):** `src/App.tsx` currently calls `supabase.storage.from("documents").createSignedUrl(...)` directly from the browser. The migration baseline intentionally removes every client policy on `storage.objects`, so this browser-side signing request is expected to be denied by Storage RLS. The current repository's Edge Functions include quiz generation but no trusted document signed-URL endpoint was found.
- Keep Storage locked to direct browser access. Implement a server-side endpoint that validates the caller's JWT, verifies the requested document belongs to that caller and is ready, derives the object path from the database (never trusts a client-supplied path), and creates a short-lived signed URL using server-only credentials. Never expose the service-role key to the client.
- Add end-to-end tests proving owner success, cross-user denial, invalid/deleted document denial, bucket/path confinement, and signed URL expiry. Until this endpoint exists and passes isolated Supabase tests, document opening is not verified and must not be treated as release-ready.
- Verify the intended private `documents` bucket configuration, size/MIME restrictions, and path conventions.
- Confirm browser users cannot directly upload/download while all client Storage policies are intentionally absent.
- Exercise the intended trusted upload/download flow end-to-end, including JWT ownership validation, content-type and size validation, generated object paths, signed URL expiry if used, and cross-user denial.
- Verify deletion and cleanup behavior when a document or user is deleted.
- If direct client Storage access is later desired, require a separate reviewed policy change and repeat two-user upload/read/update/delete tests. Never add broad bucket-wide policies.

### AZ Projects and Realtime
- Create a project through `create_project` using a real authenticated request; verify lead membership and primary project document are created atomically.
- Test lead/member/non-member permissions through PostgREST, including task assignment, task status updates, project edits, invitations, attachments, and activity visibility.
- Subscribe through the actual Realtime service as two users; confirm only authorized project members receive relevant project events and that removed members stop receiving events.
- Confirm the required tables are in the intended publication and test reconnect/resubscribe behavior.

### AZ Intelligence and sensitive RPCs
- Through real PostgREST requests, test `start_attempt`, `submit_answer`, `finish_attempt`, `get_attempt_review`, and `complete_daily_challenge` for valid, invalid, replayed, and cross-user inputs.
- Confirm private answer keys are never exposed through table reads, API schema exposure, logs, or client payloads except the intended post-answer grading response.
- Confirm credit reservation/settlement/refund/sweep RPCs are executable only by the trusted server role and cannot be invoked by anon/authenticated clients.
- Verify daily challenge idempotency, Qatar date boundary behavior, and concurrent duplicate completion attempts.
- Test actual Edge Function/server route authentication, secret injection, request validation, provider failure handling, timeouts, and cost accounting before enabling live AI calls. No API key is required for the database-only checks.

### Scheduled jobs and operations
- Install and exercise the actual `pg_cron` extension in an isolated Supabase environment.
- Verify the stuck-reservation sweep is scheduled exactly once, executes on schedule, and safely handles repeated runs and locked rows.
- Verify backups, restore procedure, observability, error alerts, and data-retention behavior.
- Exercise account deletion end-to-end, including Auth user removal, cascaded database rows, Storage object cleanup, and any retained billing/usage records.

## 3. Migration and release gates

Before any staging migration application:
1. Confirm the complete migration set and ordering are canonical.
2. Compare the committed migration history with the target project's recorded migration history using read-only inspection first.
3. Resolve missing, duplicate, or divergent migration versions explicitly; do not force-push or silently repair history.
4. Confirm a tested backup/restore path and a rollback/forward-fix plan.
5. Run the full platform checks above in an isolated project.

Before production:
- A separate approval is required for the target environment and migration/deployment operation.
- Require passing CI, reviewed PRs, verified staging checks, security review, cost limits, and a tested recovery plan.
- Do not treat a successful PostgreSQL replay as proof of full Supabase compatibility or production readiness.

## 4. Current blockers / unknowns

- The repository baseline does not currently include `supabase/config.toml`; do not invent one just to make the CLI run.
- The CI replay bypasses actual `pg_cron` installation and uses a local stub.
- Auth, PostgREST, Storage, Realtime, and Edge Runtime are not exercised by the disposable PostgreSQL workflow.
- The current browser-side `createSignedUrl` call conflicts with the locked Storage policy posture; a trusted server-side signed-URL endpoint is still required and must be tested before document opening is considered ready.
- The live project's migration history and settings have not been changed by this test work.
- No live API key, production deployment, or live database mutation is authorized by this checklist.

## 5. Completion definition

This gate is complete only when each applicable check has a recorded result, environment identifier, date, evidence link, and reviewer. Mark unsupported or untested items as **not verified**, never as passed.
