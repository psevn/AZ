# AZ — Implementation Status

Last checked: 2026-11-04. This file records observed repository/database state; it does not approve pending product or architecture decisions.

## Supabase project

- Project: `AZ`
- Region: `ap-south-1` (Mumbai)
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.11
- Applied migrations: 10 (5 original foundation migrations + 5 security migrations)
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
