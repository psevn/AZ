# AZ — Implementation Status

Initial Supabase snapshot: 2026-11-04; migration inventory rechecked: 2026-11-16. This file records observed repository/database state; it does not approve pending product or architecture decisions.

## Supabase project

- Project: `AZ`
- Region: `ap-south-1` (Mumbai)
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.11
- Applied migrations at the initial 2026-11-04 snapshot: 11 (5 original foundation migrations + 6 security migrations). The later read-only cross-check on 2026-11-16 found 30 recorded migrations; see “Migration inventory cross-check” below.
- Public tables observed: `profiles`, `subjects`, `tasks`, `focus_sessions`, `documents`, `notes`, `quizzes`, `quiz_questions`, `quiz_attempts`, `ai_usage_log`.
- RLS is enabled on all 10 observed public tables.
- The `documents` Storage bucket is private and PDF-only.

## Quiz security hotfix — applied

The following changes are applied to the live database and their migration files are in `supabase/migrations/`:

1. Temporary restrictive deny policies were applied during the transition.
2. `correct_index` and `explanation` were moved out of `public.quiz_questions` into `private.question_keys`.
3. Client roles have no schema/table access to `private.question_keys`.
4. Authenticated users can only SELECT their own question content and attempt rows. They cannot insert, update, or delete quiz questions/attempts directly.
5. `public.submit_answer` is a SECURITY INVOKER RPC wrapper. It calls `private.submit_answer`, which is SECURITY DEFINER, verifies the caller with `auth.uid()`, checks question ownership and answer bounds, records the attempt, and returns correctness/explanation only after submission.
6. Anonymous users cannot execute the grading RPC.

## Additional client-permission hardening — applied

Migration `20261104145529_restrict_client_writes_to_server_managed_tables.sql` was applied to the live database and committed to GitHub.

- `documents` and `quizzes`: authenticated clients can SELECT only their own rows; direct client writes are revoked. Trusted backend functions must create/process them.
- `ai_usage_log`: direct client writes are revoked; users retain SELECT access to their own rows under RLS.
- `profiles`: authenticated users can SELECT their own profile and UPDATE only `display_name` and `language`; they cannot modify other columns such as plan/entitlement fields.
- Post-migration checks confirmed the intended table grants and row policies.

The Supabase security advisor reports one INFO finding because `private.question_keys` has RLS enabled and deliberately has no policies; this is intentional default-deny behavior for the server-only answer-key table. The performance advisor's missing-index finding for the composite foreign key was addressed by migration `20261104145802_index_private_question_keys_owner_fk.sql`. Remaining performance INFO findings are unused indexes on a new database with no workload; do not drop them until real query usage is observed.

**Not yet runtime-tested:** the current tables contain no quiz rows, and no test-user JWT was available for an end-to-end RPC test. Do not mark quiz security acceptance tests complete until a real authenticated test submits both correct and incorrect answers and attempts cross-user/forged writes.

## Repository gaps — status rechecked 2026-11-16

- **Migration source recovery:** the missing historical migrations were recovered from recorded applied statements and added in PR #97. The PR reports 23/23 recovered-file hash matches and a clean 30-migration replay on disposable PostgreSQL 16 with documented Supabase-managed stand-ins. This is pending review; it is not yet part of `main`.
- **Projects schema:** the live Projects migrations are included in that 30-migration baseline in PR #97. Until the PR is merged, the default branch still cannot reproduce the complete observed live schema.
- **Application and deployment status:** the repository includes a web scaffold, but the presence of source files or database migrations does not establish that the complete V1 application is runtime-verified or deployed.
- **V1 completeness:** the live schema is not yet the complete approved V1 experience in `docs/SPEC.md`; planned application flows, integration tests, and credit/idempotency behavior still require implementation and acceptance.
- `docs/TASKS.md` Stage A/Stage B acceptance items remain the source for outstanding gates. Do not infer completion from the existence of a PR or an applied live migration.

## Next gates

1. Review PR #97's recovered migration files and its stated replay limits; do not apply them to the live project because they are already recorded as applied there.
2. Independently reproduce the 30-migration baseline replay on a disposable PostgreSQL environment before relying on it for a clean rebuild.
3. Recompose the pending feature stack: PR #84 document deletion, then PR #86 beta credit limits. The 30-migration baseline does not include those pending feature migrations; the combined 37-migration stack needs its own clean replay.
4. Add authenticated integration tests for quiz answer-key non-disclosure, grading, ownership, and rejected client writes.
5. Connect the app/API to the grading RPC and test through the actual UI.
6. Reconcile Stage A/Stage B acceptance in `docs/TASKS.md` against observed, executed evidence.

## Migration-source recovery — historical blocker, superseded 2026-11-16

The 2026-11-04 investigation correctly recorded that the original foundation SQL bodies were not present on the then-inspected `main` branch and must not be reconstructed from memory. That blocker was addressed in PR #97: the PR adds the missing migration files using the recorded applied statements, reports trimmed-content hash equality for all 23 newly recovered files, and records a disposable PostgreSQL 16 replay of all 30 migrations.

**Current status:** recovery is present on branch `chore/sync-live-migrations` and pending PR review/merge. It is not yet present on `main`. The replay used stand-ins for Supabase-managed components and a stub for the `pg_cron` extension; see “Migration inventory cross-check” for exact scope and limitations.

The historical findings are retained for audit context, not as current next steps:

- On 2026-11-04, the migration-history interface exposed version/name metadata but not original SQL bodies.
- The then-inspected `main` tree lacked the five foundation SQL files.
- The safe rule remains: never reconstruct an applied migration from the current schema and label it as the original.

Do not apply PR #97's recovered files to the live project; those versions are already recorded there. Review and validate them through a disposable replay only.

## Least-privilege grants for user-managed tables — applied

Migration `20261104150300_limit_client_table_grants_to_crud.sql` was applied to the live Supabase database and committed to GitHub.

- For `subjects`, `tasks`, `focus_sessions`, and `notes`, the `authenticated` role now has only SELECT, INSERT, UPDATE, and DELETE table privileges.
- Excess table privileges such as TRUNCATE, TRIGGER, and REFERENCES were revoked from browser clients.
- No table-level privileges were granted to `anon`.
- Existing per-user RLS policies remain in place.
- Post-migration grant inspection confirmed exactly the four intended CRUD privileges for authenticated clients on these four tables.

## Latest advisor review

- Security advisor: one INFO finding remains on `private.question_keys` because RLS is enabled and there are deliberately no client policies (default-deny).
- Performance advisor: 17 INFO findings report unused indexes. The project has no meaningful production workload/data yet; these indexes are not dropped merely to silence the advisor. Reassess after representative queries and load testing.
- These advisor INFO findings are not proof of end-to-end authorization correctness. Authenticated multi-user tests remain outstanding.

## Schema validation review — 2026-11-04

Read-only inspection of current constraints and storage policies found:

- Ownership is reinforced by composite foreign keys for tasks/subjects, focus sessions/tasks, documents/subjects, quizzes/documents, quiz questions/quizzes, attempts/questions, and notes/documents. These prevent cross-user references even if a caller supplies another user's UUID.
- Database checks currently constrain task status to `todo`/`doing`/`done`, priority to 1–3, positive estimated minutes, and title length 1–300; subject names are 1–120 characters. Focus sessions reject an end time earlier than the start time. Quiz mode is constrained to `standard`/`professional`.
- Storage object policies are scoped to the private `documents` bucket and require the first path segment to match the authenticated user's UUID for select/insert/update/delete.
- **Spec alignment item:** live `documents.status` currently allows `uploaded`, `processing`, `ready`, and `failed`, while the draft SPEC describes `completed` rather than `ready`. Do not silently change this in the database; reconcile the vocabulary in the approved SPEC and implementation before document processing is built.
- **Account-deletion item:** relational rows have `ON DELETE CASCADE` references to `auth.users`, but Storage objects are not deleted by relational cascades. The future account-deletion backend must explicitly remove each user's objects from the `documents` bucket before/while deleting the Auth user, and verify no orphaned files remain.

No additional schema migration was applied during this read-only review. These items are recorded as implementation follow-ups, not completed functionality.


## Stage B web scaffold — committed, not yet runtime-verified

Checked on 2026-11-04:

- PSEVN approved SPEC v0.2 as the V1 implementation baseline; the approval is recorded in `DECISIONS.md`, `SPEC.md`, and `TASKS.md`.
- Added the first React + TypeScript + Vite web app scaffold under `src/`.
- Added Arabic-first responsive sign-up/sign-in UI, English toggle, RTL/LTR, dark/light theme, and a basic authenticated subjects list.
- The browser client uses only the Supabase Project URL and Publishable key. No service-role key or secret is present in frontend source.
- Subject reads and inserts use the existing `public.subjects` table and rely on its authenticated RLS policies. The insert uses the user ID returned by Supabase Auth; RLS remains the enforcement boundary.
- Added `.env.example`, `.gitignore`, `README.md`, and a basic PWA manifest.
- Dependencies are pinned to exact versions in `package.json`. A `package-lock.json` must be generated and committed by running `npm install` in the owner's local project.
- **Not yet runtime-verified:** no local build, browser sign-up/sign-in test, two-user isolation test, or production deployment has been run. The Supabase Publishable key has not been placed in local environment configuration. Do not describe this as a working deployed app yet.
- Remaining Stage B work includes invite-code gating, complete app navigation, credit RPCs, end-to-end tests, PWA offline support, deployment, and verification of email redirect settings.


## Migration inventory cross-check

A follow-up comparison of the live Supabase migration history against the GitHub `supabase/migrations/` directory found that the repository held only 7 of the 30 migrations recorded in the live project, with two version mismatches. Status of this finding (2026-11-16, branch `chore/sync-live-migrations`):

- **Recovered.** The 23 missing migrations were exported verbatim from the live `supabase_migrations.schema_migrations` history (read-only) and added under their live version numbers. Each file's content hash (after trimming leading/trailing whitespace) equals the hash of the applied statement in the live history.
- **Renamed to the live versions** (file content unchanged): `20261104145802_index_private_question_keys_owner_fk.sql` is now `20261104145805_...`, and `20261105160000_add_academic_planning_foundation.sql` is now `20261105153306_...`. The planning foundation migration **is applied** in the live project (the statement in `AZ_PLANNING_SPEC.md` §12 that it was not applied is outdated).
- **Comment-only differences** remain in four older repository files (`20261104144855`, `20261104145529`, `20261104145805`, `20261104150300`): their SQL is the same as the applied statement, but the comments differ. They were left as they are.
- **Clean-rebuild test.** All 30 migrations were replayed in version order on an empty local PostgreSQL 16 database with minimal stand-ins for the Supabase-managed pieces (`auth.users` and `auth.uid()`, `storage.buckets` and `storage.objects`, the `anon`/`authenticated`/`service_role` roles with Supabase-style default privileges, the `supabase_realtime` publication, and a stub `cron` schema). All 30 applied without error, and a fingerprint of columns (247), constraints (178), indexes (107), RLS policies (45), functions (27, including bodies), triggers (5) and table grants (298) in the `public` and `private` schemas matched the live project exactly.
- **Not covered by that test:** the real `pg_cron` extension (the `create extension` line was stubbed locally), storage bucket objects, `auth` and `storage` schema internals, data, the `private` schema's own function privileges, and anything created in the live project outside the migration history. Treat it as strong evidence, not proof, that `supabase db reset` reproduces the live schema.
- Do not apply any of these files to the live project. They are already applied there.
