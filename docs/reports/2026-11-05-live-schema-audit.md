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

---
## Update — 2026-11-05 (afternoon): gaps closed after PSEVN's approvals

PSEVN approved: (1) submit_answer fix, (2) server-signed storage uploads, (3) fix schema gaps with migrations, (4) keep and develop the `notes` table (P2 / Mini Notebook candidate).

Applied to the live project in order (tested first on the local replica: **201 passed, 0 failed, 6 informational gaps**):
| Version | Migration | What |
|---|---|---|
| 20261105073535 | fix_submit_answer_ambiguous_created_at | grading RPC bug |
| 20261105122212 | add_spec_columns_tables_and_lock_storage | SPEC columns, 7 new tables (credits/spend/pages/summaries), fail-closed defaults (0 credits, 0 cap), column-limited `ai_usage_log` reads, client storage policies dropped, bucket limit 20 MB |
| 20261105122304 | quiz_attempts_per_quiz | per-quiz attempts + `attempt_answers`; RPCs `start_attempt`, `submit_answer(attempt, question, choice)`, `finish_attempt` |

Live verification: rolled-back runtime test as a real `authenticated` user (start, correct grading, duplicate blocked, score 100, forged attempt blocked, `request_key` unreadable, self-upgrade to `pro` blocked, other user blocked, storage invisible); afterwards 0 users/attempts/documents remain. Security advisors: only 3 INFO items (`question_keys`, `app_config`, `spend_counters` have RLS and no policy) — intentional server-only tables.

Note: `authenticated` can call `private.start_attempt/submit_answer/finish_attempt` directly because the public wrappers are SECURITY INVOKER; this is safe because each function checks `auth.uid()` and ownership itself (tested).

Remaining gaps: Storage object deletion on account deletion; credit RPCs (reserve/settle/refund/sweep) + concurrency tests; `profiles.id` vs SPEC `user_id`; SPEC says subject delete cascades but DB uses SET NULL (recommend aligning SPEC); the 5 original foundation migration files are still missing and the 145805/145802 version mismatch remains; real two-user API test still required.

## Update — 2026-11-05 (evening): credit system (M3) applied live

Migration `20261105123204_credit_reservation_rpcs` (applied live, SPEC §9): `reserve_credits`, `settle_credits`, `refund_credits`, `sweep_stuck_reservations` (public INVOKER wrappers over `private` SECURITY DEFINER functions, **service_role only**; anon/authenticated denied). Adds `ai_usage_log.cost_reserved/cost_actual`.

Behaviour: idempotent per (user, feature, request_key); daily limit, monthly limit and global monthly cost cap checked atomically under row locks (lock order: log row → day → month → global spend); fail-closed (cap 0 or limits 0 deny; denials are logged and reserve nothing); settle moves reserved→used and estimated→actual cost; a settled request cannot be refunded; sweep refunds reservations older than `max_reserved_age_minutes`; periods are UTC.

Tests (`supabase/tests/credits_tests.py`, run by `run_local.sh`): 61 checks incl. real concurrency (all workers released together through an advisory-lock gate): 30 parallel reserves with limit 5 → exactly 5; 20 parallel same-key → exactly 1; global cap under 16 parallel reserves across 2 users; parallel settles/refunds/sweeps; counters always equal the log. **Mutation check:** removing the row locks makes the concurrency test fail (7 reserved instead of 5), so the test does detect the race. Live: rolled-back runtime test passed (defaults deny, reserve/replay/settle/refund/limit, authenticated + anon blocked) and the live tables were left empty; advisors unchanged (3 intentional INFO).

Not covered: no real provider yet (mock only); no Edge Function yet; load on the real Supabase connection pooler; UTC day boundary vs Qatar (UTC+3) — daily limit resets at 03:00 Qatar time, decide whether to align.

## Update — 2026-11-08: V1 Final Scope support (M4) + review of ChatGPT's live changes
Applied live: `20261108121410_exam_mode_flashcards_question_metadata` (see docs/V1_SCOPE.md §2). Local: 275 + 61 checks passed; live: rolled-back runtime test passed (exam hides answers, review blocked until finish, final score, flashcard progress, forged answers/anon/other user blocked); live tables left empty.

ChatGPT's changes found on the live project: `add_academic_planning_foundation` (version 20261105153306 live vs file 20261105160000 in the repo — **version mismatch, same class as before**; isolation tests added and passing) and `schedule_sweep_stuck_reservations` (pg_cron job every 5 min calling `private.sweep_stuck_reservations(100)`; **migration file is not in the repository** — ChatGPT should commit it as applied, not reconstructed by me). One real user now exists in the live project.
New advisor warning: **Auth leaked-password protection is disabled** (Auth setting; check whether the current plan allows enabling it).

## Update — 2026-11-08: exam mode, flashcards, audit of ChatGPT's migrations

Applied by Claude: `20261108121410_exam_mode_flashcards_question_metadata` (see docs/V1_SCOPE.md) — tested locally (275 + 61 checks) and on the live project with a rolled-back runtime test.

Audit of what ChatGPT applied to the live project on 2026-11-05/08 (planning foundation, pg_cron sweep, 9 `az_projects*` migrations):
- **Planning tables** (`academic_terms`, `class_meetings`, `academic_setup`): isolation correct, composite FKs correct — added to the local suite (16 checks).
- **Project tables**: cross-user isolation correct (a second user sees 0 rows, cannot join, cannot self-promote to lead, cannot add tasks; anon blocked). `planning_items` is `security_invoker`, correctly filtered.
- **BUG (fixed, `20261108153310`)**: `public.create_project()` failed with 42501 for every real user (INSERT … RETURNING hit the SELECT policy before the creator was a member). Fixed by generating the id first and inserting without RETURNING.
- **Hygiene (fixed, same migration)**: project tables had default grants — `anon` ALL (incl. TRUNCATE), `authenticated` TRUNCATE/TRIGGER/REFERENCES. Revoked; CRUD stays.
- **Open, for ChatGPT**: (a) the SQL of the pg_cron migration and of **all 9 project migrations is not in the repository** and the planning migration's file version (`20261105160000`) differs from the live version (`20261105153306`) — same process failure as the five missing foundation migrations; committing the exact applied SQL (from `supabase_migrations`) is required, not reconstruction; (b) `private.is_project_member(project, user)` is executable by `authenticated` with an arbitrary user id, so a user who knows a project id could probe whether another user is a member (low severity; tighten to `auth.uid()` or keep it out of client reach); (c) the project tables are not covered by the local test suite until their SQL is in the repo; (d) Auth: leaked-password protection is disabled in the Supabase dashboard (advisor WARN) — enable it.
