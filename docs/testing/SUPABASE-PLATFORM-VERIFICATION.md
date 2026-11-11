# Supabase Platform Verification Checklist

**Status:** Pre-deployment test plan  
**Applies to:** AZ canonical migration baseline, AZI, AZ Projects, document storage  
**Last updated:** 2026-11-11

This checklist identifies behavior that a disposable PostgreSQL replay cannot prove. It is a release gate plan, not authorization to connect to, modify, or deploy to the live Supabase project.

## 1. Current local/CI evidence and limits

The clean replay workflow runs the committed migrations against disposable PostgreSQL 16 with local stubs for Supabase-managed services. It can validate SQL replay, schema objects, selected grants, RLS behavior for representative rows, and RPC behavior that depends only on PostgreSQL.

It does **not** reproduce the Supabase Auth service, PostgREST request pipeline, Storage API, Realtime service, Edge Runtime, pg_cron extension runtime, or the target project's migration history and configuration.

The Storage migration sequence deliberately removes direct client policies on `storage.objects`. Keep that locked-client-storage posture. Document upload and download must use the trusted server-side endpoints described below; do not restore broad browser Storage policies to make a request succeed.

## 2. Required isolated Supabase staging checks

Use only a separate disposable Supabase project or isolated local Supabase stack with the actual Supabase services. Do not use production credentials for these checks. Do not expose a service-role key to browser code.

### Auth and PostgREST

- Sign in as two independent test users and issue requests through the real PostgREST API using their actual JWTs.
- Confirm `auth.uid()` resolves to the expected user for each request and cannot be spoofed by request payload fields.
- Repeat cross-user read/write denial tests for subjects, tasks, documents, quizzes, quiz attempts, Planning, AZ Projects, project documents, attachments, and activity.
- Confirm unauthenticated/anon requests cannot read private user data or execute authenticated-only RPCs.
- Confirm service-role access is restricted to trusted server environments and never shipped to the client.
- Verify PostgREST exposed schemas, function discovery, schema cache refresh, and actual RPC argument/return serialization.

### Storage API and AZ PDF pipeline

The current repository source includes a trusted server-side document flow:

- `create-document-upload-url` authenticates the caller, creates the owner-scoped `documents` row, derives the object path from the authenticated user ID and document UUID, and issues a signed upload token for the fixed private `documents` bucket.
- `create-document-signed-url` authenticates the caller, reads the document under the caller's JWT/RLS, checks the owner and the database-owned storage-path prefix, and signs only that path in the fixed bucket with the server-only service-role key.
- The signed-URL endpoint intentionally allows `uploaded`, `processing`, and `ready` states so the owner can preview a newly uploaded PDF and recover interrupted processing. It denies failed, deleted, unknown, and non-owned documents. Links expire after 300 seconds.
- `process-document-pages` authenticates the caller, verifies document ownership, and delegates start/resume/page-save/complete/fail actions to the service-role-only atomic RPC. The browser must not write directly to `documents` or `document_pages`.

**Important rollout distinction:** the source code in the open document PR stack is not the same as the currently deployed Staging revision. The Staging signed-URL function is still an older revision that only permits `ready` documents, and the atomic processing migration / `process-document-pages` function have not been applied or deployed. Therefore the full pipeline is **not yet verified on AZ-Staging**. Do not deploy or apply the migration without explicit approval.

Before release, use the dedicated [AZ-Staging PDF acceptance checklist](AZ-STAGING-PDF-ACCEPTANCE.md) and record evidence for these checks:

- Upload a harmless selectable-text PDF through the Academic workspace as User A. Confirm the normal flow reaches `ready`, records the expected page count, and the Study Reader can fetch the saved pages.
- Sign in as User B. Confirm A's document is absent from B's library and B receives 404 when requesting a signed URL for A's document ID.
- As User A, confirm the owner can preview/open the PDF. Confirm a signed URL stops working after its five-minute expiry.
- Confirm direct browser Storage reads/writes remain denied; do not add client Storage policies as a workaround.
- Upload a scanned/image-only PDF. It must fail with the explicit OCR-unavailable reason and must never be marked `ready`.
- Exercise stale recovery only after the lock is older than 30 minutes. The current attempt may continue; an old processing token must receive 409 after a successful resume.
- Verify upload size/MIME restrictions, failed/unknown document denial, and cleanup behavior in the isolated environment.

Do not fabricate a `documents` row or Storage object with SQL to simulate an upload. Do not send passwords, JWTs, signed URLs, or service-role credentials in chat or commit them to the repository. The disposable PostgreSQL atomic fixture verifies transaction and fencing behavior, but it does not replace this two-user Supabase integration test.

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
- The document PR stack is still open and unmerged; the updated signed-URL source, atomic processing migration, and processing Edge Function still require explicit Staging approval and a real two-user integration run.
- The live project's migration history and settings have not been changed by this test work.
- No live API key, Production deployment, or live database mutation is authorized by this checklist.

## 5. Completion definition

This gate is complete only when each applicable check has a recorded result, environment identifier, date, evidence link, and reviewer. Mark unsupported or untested items as **not verified**, never as passed.
