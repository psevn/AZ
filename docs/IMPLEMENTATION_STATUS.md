# AZ — Implementation Status

Last checked: 2026-11-04. This file records observed repository/database state; it does not approve pending product or architecture decisions.

## Supabase project

- Project: `AZ`
- Region: `ap-south-1` (Mumbai)
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.11
- Applied migrations: 11 (5 original foundation migrations + 6 security migrations)
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

## Repository gaps

- The current repository has five new security migrations, but the five original foundation migration source files are still missing from GitHub. A fresh environment therefore cannot yet recreate the live database from the repository alone.
- No application source code is present in the inspected `main` tree.
- No Supabase Edge Functions are deployed.
- The live schema is not yet the complete V1 schema in `docs/SPEC.md`; several planned tables and credit/idempotency mechanisms remain unimplemented.
- `docs/TASKS.md` still has Stage A approval and Stage B acceptance tasks unchecked. The presence of applied database migrations does not mean those stages are complete.

## Next gates

1. Recover and commit the exact five original migration files from the source that applied them; do not reconstruct them from memory.
2. Add authenticated integration tests for answer-key non-disclosure, grading, ownership, and rejected client writes.
3. Connect the app/API to the grading RPC and test through the actual UI.
4. Implement the remaining V1 schema and credit controls only against the approved specification.
5. Reconcile Stage A/Stage B documentation after PSEVN confirms the pending v0.2 decisions.

## Migration-source recovery — blocked pending original files

Checked on 2026-11-04:

- Supabase migration history confirms the first five versions/names are `20261104141452 core_schema`, `20261104141502 storage`, `20261104142612 storage_documents_policies`, `20261104143417 fk_covering_indexes_and_storage_path_check`, and `20261104143425 profile_autocreate_and_handoff_comments`.
- The Supabase migration-history interface exposes version/name metadata only; it does not return the original SQL bodies.
- The GitHub `main` tree contains only the five security migration files, not the five original foundation files.
- No exact original SQL source was found in prior project context. The local working copy is known to be `C:\\Users\\ASUS\\Projects\\AZ`, but this session cannot read files from that Windows path.

**Do not recreate these five files from the current schema and label them as originals.** That would hide migration drift and may fail to reproduce triggers, policies, functions, storage configuration, or ordering.

Next action: retrieve the exact five SQL files from the environment/tool that originally created/applied them (likely the original local/Claude working directory), then commit those exact files to `supabase/migrations/`. Until then, a clean database cannot be reliably rebuilt from this repository alone.

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
