# Live schema audit — 2026-11-05

Author: Claude. Scope: the Supabase project "AZ" as it exists today, against the approved SPEC v0.2 (§5.5 isolation, §7 quiz security, §10 database part of account deletion).

## Method
1. Read-only catalog queries against the live project (tables, constraints, indexes, functions, triggers, policies, grants, bucket config). Nothing was written to the live project.
2. The result was written to `supabase/baseline/live_schema_snapshot_2026-11-05.sql` (labelled as a reconstruction of the current state, NOT the original migration history).
3. A throwaway local PostgreSQL 16 was built from that snapshot plus small stubs for Supabase's `auth` and `storage` (`supabase/tests/local_stubs.sql`).
4. `supabase/tests/live_schema_tests.py` runs each check as a fresh session under the real roles (`anon`, `authenticated`, `service_role`) with two users, A and B, each owning rows in every table.
5. Reproduce: `bash supabase/tests/run_local.sh` (set `SKIP_PROPOSED=1` to test the live schema without the proposed fix).

## Limits of this audit (not covered)
- Local PostgreSQL 16 vs. live 17.11; stubs replace Supabase's Auth/JWT, PostgREST and the Storage API. Storage checks validate the **policy logic** only; file-size/MIME limits, signed URLs and real uploads are untested.
- `service_role` table privileges were assumed to be Supabase's default (all).
- No concurrency, load, credit, idempotency, or PDF tests (those features do not exist yet).
- A test with two real signed-in users through the real API is still required before Stage B can be called done.

## Results
| Run | Passed | Failed | Gaps |
|---|---|---|---|
| Live schema as it is today | 115 | **3** | 11 |
| Live schema + proposed fix | 118 | 0 | 12 |

(The extra gap in the second run appears because the function now works and exposes a design limit, below.)

### Confirmed good
- Two-user isolation: B cannot read, update, delete or insert into A's rows in any of the 10 public tables; positive controls pass (owners can use their own rows).
- Composite foreign keys block cross-user links, including for `service_role`, which bypasses RLS.
- `anon` has no access to any table or to `submit_answer`; clients cannot read `private.question_keys`, even the owner.
- Clients cannot insert/alter `documents`, `quizzes`, `quiz_questions`, `quiz_attempts`, `ai_usage_log`; they cannot forge or flip attempts.
- `profiles`: only `display_name` and `language` are editable; the signup trigger creates profiles.
- Deleting an auth user removes every row for that user in every table and leaves the other user untouched.
- Storage policy logic: users can only touch objects under their own `{user_id}/` folder.
- RLS is enabled on every table; `question_keys` has zero policies (default deny, by design).

### Bug found (real, live)
**`private.submit_answer` fails on every valid answer** with `42702: column reference "created_at" is ambiguous`. The function returns a table with a column named `created_at` (also `is_correct`, `correct_index`, `explanation`); inside the function those names are variables, which collide with the column in `INSERT ... RETURNING id, created_at`. Wrong-input paths (no user, bad index, other user's question) work, which is why a quick check would not notice it. The grading RPC currently cannot grade anything.
Fix (proposed, tested locally, **not applied**): `supabase/proposed/20261105000001_fix_submit_answer_ambiguous_column.sql` aliases the table in the `RETURNING` clause. After it, correct/incorrect grading, ownership, range and auth checks all pass.

### Gaps versus the approved SPEC (informational, none applied)
| Gap | Why it matters | Proposed handling |
|---|---|---|
| Missing tables: `document_pages`, `summaries`, `usage_counters`, `spend_counters`, `usage_limits`, `credit_costs`, `app_config` | No credits, no spend cap, no page-level text | Additive migrations in later slices (Stage B credits, Stage C) |
| `ai_usage_log` lacks `request_key`, status, credits, result ref, prompt version | Atomic reserve/refund and idempotency are impossible | Additive columns + unique `(user_id, feature, request_key)` |
| `documents` lacks `sha256`, `page_count`, `kind`, `failed_reason`, `attempts`, `locked_at`, `processed_at` | PDF status machine, dedup, retries impossible | Additive columns |
| `subjects.exam_date`, `tasks.note` missing | Home countdown and task descriptions | Additive columns |
| Clients can upload/overwrite/delete in their own storage folder (3 policies) | SPEC says server-only uploads; page/size/dedup checks can be bypassed; deleting a file leaves an orphan document row | **Decision for PSEVN** (see below) |
| Bucket limit is 50 MB | SPEC start value was 20 MB (configurable) | Align after the decision |
| `submit_answer` can be called unlimited times per question and always reveals the answer | No notion of a quiz attempt with a score | Redesign to attempt-per-quiz (SPEC §5.4) before the UI depends on it |
| `notes` table exists | Mini Notebook is outside V1 | Do not build UI; confirm keep or drop |
| `profiles.id` (SPEC: `user_id`); no `plan` / `deletion_requested_at` | Plan limits and account deletion need them | Add columns; naming difference accepted or aligned |
| Subject deletion keeps tasks/documents (SET NULL) | SPEC says cascade; SET NULL is arguably safer | Update the SPEC to match, unless PSEVN prefers cascade |
| Storage objects are not deleted with the account | Orphaned files after deletion | Server-side deletion function + test against real Storage |

## Process findings
- Five foundation migrations were applied to the live project and their SQL is not in the repository. A clean rebuild from the repository is not possible. Recovery needs the tool/workspace that applied them; do not reconstruct.
- The migration version `20261104145805` (live) vs file `20261104145802` (repository) mismatch remains unresolved.

## Decisions needed from PSEVN
1. Approve applying the `submit_answer` fix to the live project (one function; project holds no user data yet).
2. Storage uploads: keep direct client upload (simpler; limits enforced only by bucket config) or move to server-signed uploads per SPEC (safer, enables page/size/dedup checks)? Recommendation: server-signed uploads.
3. Approve additive schema migrations for the gaps above, in slices, each tested locally first.
4. Keep or drop the `notes` table.
