---
name: az-rls-isolation-tests
description: Use when a table, view, RPC, storage policy or Edge Function is added or changed, and before closing a stage. Writes and runs two-user isolation tests (user B cannot read, write, link to or delete user A's data) and reports the results.
---

# AZ isolation tests

AZ's first promise is that one student's data is never visible to another. A new table or function is not done until an isolation test **ran** and passed. This skill turns SPEC §5.5 into a repeatable procedure. Table names below follow the live schema (for example `quiz_questions`, `ai_usage_log`); read the live catalog instead of trusting any list in a document.

## 1. Where to run
- Run against **`AZ-Staging`** (`tskdpubkxkirtmrwujrs`) or a local database, not against production data. Confirm the project id before every call.
- Inside SQL tests use a transaction that ends with `rollback`, so nothing remains. Create the two test users in Staging only, with throwaway emails, and delete them afterwards.
- Staging's migration history may differ from production and from the repo (it records different version numbers, and may hold migrations that production does not). Before trusting a result, compare Staging's schema with the migrations in the repo and say what differs.

## 2. Build the test list from the live catalog
1. List every table and view in `public` (and the `private` tables used by functions) with its RLS status and policies. Do not rely on SPEC §5.4 names.
2. List every function callable by clients (`public.*` with `execute` for `authenticated` or `anon`) and every `security definer` function.
3. Classify each table: own-rows read/write, own-rows read-only, member-based (Projects), or no client access (`private.question_keys`, spend/config tables). The expected result for each class is the pass criterion.

## 3. Simulate users in SQL
Inside a transaction, switch role and set the JWT claims that `auth.uid()` reads (the live function reads `request.jwt.claim.sub` and falls back to the `sub` field of `request.jwt.claims`):
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<user B uuid>', 'role', 'authenticated')::text, true);
-- statements as user B ...
rollback;
```
Anonymous: `set local role anon;` with no claims.

## 4. Required cases (per table, per operation)
- **Read:** with B's claims against A's ids, `select` returns zero rows.
- **Insert:** B inserts a row with `user_id = A` is rejected. B inserts a child with B's `user_id` but A's `parent_id` is rejected by the composite foreign key.
- **Update and delete:** B cannot change or delete A's rows (zero rows affected, or an error). B cannot change `user_id` on its own rows.
- **Anonymous:** every table rejects `anon`.
- **Server-managed tables:** a client cannot insert answers, usage rows, counters or scores; forged `is_correct`/`score` inserts are rejected.
- **Answer keys:** no client-readable table or function result contains the correct answer before submission (SPEC §7).
- **Functions:** each `security definer` function rejects an id that belongs to another user, takes `user_id` from `auth.uid()` and never from arguments, and has `execute` revoked from `public` and `anon`.
- **Projects:** a non-member cannot read or write any `project_*` row; a member cannot see another member's private study data; role rules hold (lead vs member).
- **Storage:** B cannot list, read or write under `{A}/` in the private bucket. Test through the Storage API with B's session, not only SQL.
- **Catalog check:** every table in `public` has RLS enabled; run the Supabase security advisor and read every finding.

## 5. Report
Output a table: object, operation, expected, actual, pass/fail, plus the project and the commit tested. State what was not tested (for example storage through the real API, realtime subscriptions). A failed case blocks merge; fix the policy or grant with a new migration (see `az-db-migration`), then re-run the whole list.
