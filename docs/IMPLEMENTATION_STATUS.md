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

- The current repository has six security migration files, but the five original foundation migration source files are still missing from GitHub. A fresh environment therefore cannot yet recreate the live database from the repository alone.
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
- The GitHub `main` tree contains only the six security migration files, not the five original foundation files.
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

A follow-up comparison of the live Supabase migration history against the GitHub `supabase/migrations/` directory found a filename/version discrepancy that must be reconciled before relying on a clean database rebuild:

- Live history reports `20261104145805 index_private_question_keys_owner_fk`.
- GitHub currently contains `20261104145802_index_private_question_keys_owner_fk.sql`.
- Do not rename or replay either migration until the exact applied SQL and source history are reconciled.
- The original five foundation migration SQL bodies are not present in the repository's historical commits checked so far; the earliest planning commit contains only the three docs files. Recovery still requires the original authoring workspace or an exact SQL export/source.

## Quiz answer-response contract — live schema reconciliation 2026-11-11

The live Supabase project was inspected using read-only catalog queries. No database objects or data were changed.

### Verified live quiz lifecycle

The live schema already contains a complete attempt model:

- `public.quiz_attempts`: `id`, `user_id`, `quiz_id`, `score`, `started_at`, `finished_at`, `mode` (`practice`/`exam`), and optional `time_limit_seconds`.
- `public.attempt_questions`: snapshots the questions and their order for one attempt; unique on `(attempt_id, question_id)` and `(attempt_id, position_no)`.
- `public.attempt_answers`: records one answer per question per attempt; unique on `(attempt_id, question_id)`.
- Composite foreign keys enforce that attempts, questions, and answers belong to the same user and quiz.
- `private.start_attempt(p_quiz_id, p_mode, p_question_count, p_time_limit_seconds)` creates a new attempt and snapshots its selected questions.
- `private.submit_answer(p_attempt_id, p_question_id, p_chosen_index)` validates attempt ownership/state, checks question membership, records the answer, and in practice mode returns correctness/explanation.
- `private.finish_attempt(p_attempt_id)` calculates the score from recorded answers and the attempt's question snapshot, then sets `finished_at`.
- `private.get_attempt_review(p_attempt_id)` exposes the answer key only after the attempt is finished.
- Public wrappers `start_attempt`, `submit_answer`, `finish_attempt`, and `get_attempt_review` are present.

The live `private.submit_answer` and `public.submit_answer` signatures are three-argument functions: `(uuid, uuid, smallint)`. The private function currently returns `correct_index`, and its ACL includes `authenticated`; the public wrapper also returns `correct_index`. Therefore, the earlier two-argument proposal was based on incomplete repository-only source inspection and did not match the live database.

### PR #42 correction

PR #42 now proposes to preserve the existing three-argument RPC name/signature while removing `correct_index` from the browser response. It revokes direct authenticated execution of the private key-bearing function and replaces the public wrapper with a hardened `SECURITY DEFINER` wrapper that checks `auth.uid()` and returns only `is_correct`, `explanation`, and `answered_at`. Exam mode intentionally returns null correctness/explanation until post-finish review.

The SQL remains under `supabase/proposals/`; it is not a migration and has not been applied. Its Node test is a static contract test, not PostgreSQL integration verification.

### Remaining repository/live-database drift

The live migration history includes `20261105122304_quiz_attempts_per_quiz` and additional migrations that are not represented in the inspected PR #41 branch migration directory. The five original foundation migration bodies also remain absent from GitHub. Do not assume the current branch can recreate the live database from scratch, and do not generate new quiz-attempt tables: the live lifecycle already exists.

### Next implementation slice

Connect the existing QuizPage to the established RPC flow:

1. Select a ready document and generate/save a quiz through the existing server function.
2. Start a real attempt with `start_attempt`, using the returned attempt ID and question snapshot.
3. Submit each answer through the three-argument `submit_answer` RPC; never infer correctness in the browser.
4. Finish through `finish_attempt` and use the server-returned score/counts.
5. Load answer-key review only after the attempt is finished.
6. Keep Daily Challenge integration separate until this Study Pack quiz path is working end-to-end.

No API key, Edge Function deployment, live database change, or production deployment was performed during this inspection.


## Study Pack quiz client runtime — PR #43

PR #43 connects the non-demo QuizPage to the existing server attempt lifecycle:

- Ready documents are loaded and selectable as quiz sources.
- The client invokes the `generate-quiz` Edge Function with the selected document, language, question count, and optional topic.
- The client starts a new server-owned attempt with `start_attempt`.
- Questions are loaded from the attempt's immutable `attempt_questions` snapshot and related `quiz_questions` rows; the client checks that the loaded count matches the server's snapshot count.
- Answers are submitted through `submit_answer`; the client does not carry `correct_index` or calculate live correctness.
- Completion and score come from `finish_attempt`.
- Retry creates a new attempt against the same quiz rather than reusing previous answer rows.
- Synthetic answer feedback remains isolated to explicit `VITE_DEMO=1` visual demo mode.

GitHub Actions verified on 2026-11-11: `npm ci`, `npm run build`, quiz runtime contract tests, safe answer SQL proposal tests, and quiz generation contract tests passed. These are build/static-contract checks, not an authenticated end-to-end test against Supabase.

**Not live-enabled:** the `generate-quiz` Edge Function is not deployed, `OPENAI_API_KEY` is not configured, and the live database does not yet contain `public.create_generated_quiz` (the SQL remains a proposal). Therefore the UI integration is committed for review but real document-to-quiz generation is not yet operational. No API key was created, no function was deployed, and no database migration was applied.

## Generated quiz persistence security — PR #44

Read-only schema reconciliation on 2026-11-11 confirmed that the live database already has the exact persistence tables and ownership relationships needed by the Study Pack generator:

- public.quizzes(user_id, document_id, mode) with a composite owner FK to documents(id, user_id).
- public.quiz_questions with prompt, choices, question_type, source_page, topic, and difficulty; its composite FK binds each question to its quiz and user.
- private.question_keys(question_id, user_id, correct_index, explanation) with a composite owner FK to quiz_questions(id, user_id).
- public.document_pages(document_id, user_id, page_no, text) with a composite owner FK to the source document.
- The relevant public tables have RLS enabled and authenticated read policies scoped to auth.uid(). private.question_keys remains default-deny for client roles.

PR #44 (feature/azi-secure-generated-quiz-persistence) hardens the existing proposal and validation contract:

- Enforces 5–20 questions, exact question-object keys, four distinct non-empty choices, bounded text sizes, valid numeric metadata, unique prompts, and page references that exist in the selected ready document.
- Separates JSON type checks before calling array/object accessors, so scalar/null input is rejected without relying on boolean-expression evaluation order.
- Stores correct_index and explanation only in private.question_keys; the returned JSON contains question content and source metadata only.
- Uses a SECURITY INVOKER function with an empty search_path. Read-only privilege checks confirmed service_role already has the required schema usage, document/page SELECT, and quiz/question/key INSERT privileges; execution is revoked from PUBLIC, anon, and authenticated and granted only to service_role.
- The Edge Function derives p_user_id from a verified Supabase Auth user, checks document ownership with the user-scoped client, and performs persistence using the server-only service-role client.
- The shared generator validator now applies matching object-shape and text-size limits before persistence.
- Adds static contract tests and a dedicated GitHub Actions step.

The model default gpt-6-astra was checked against the current OpenAI Responses API model documentation on 2026-11-11. This is documentation verification only; no API request or key was used.

**Verification boundary:** PR #44 is proposal/code/test work only. The SQL has not been executed against PostgreSQL, converted to a numbered migration, or applied to Supabase. Static contract tests do not replace a local database test. The generate-quiz Edge Function remains undeployed, OPENAI_API_KEY remains unset, and there has been no live database write, API-key creation, or production deployment.


## Daily Challenge minimum-question alignment — PR #45

The generated quiz persistence contract accepts 5–20 questions. The original Daily Challenge selector defaulted to 3, which could produce an action that the current generator cannot fulfill.

PR #45 (feature/azi-daily-challenge-minimum-five), stacked above PR #44:
- Raises the selector default to 5 and rejects caller overrides below 5.
- Requires topic and ready Study Pack candidates to have at least the requested count; four-question sources no longer qualify.
- Updates the selector tests for the five-question boundary and Qatar-local date fixture.
- Extends the engagement-test workflow to run for this stacked PR base branch.

This is a selector-contract alignment only. It does not yet persist challenge state, launch the quiz UI, associate a challenge with quiz_id/attempt_id, or award points. Per the engagement specification, completion must remain tied to a verified completed attempt; no challenge reward is granted by selection or by merely starting a quiz.
