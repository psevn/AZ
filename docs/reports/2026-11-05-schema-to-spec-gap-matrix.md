# AZ V1 — Schema-to-SPEC gap matrix

Date: 2026-11-05  
Status: review artifact based on the 2026-11-05 read-only live-schema audit and approved SPEC v0.2. Verify live state again before writing any migration. This matrix is not a migration script and does not authorize schema changes.

## 1. Existing objects vs approved model

| Approved SPEC object | Observed live object | Status / gap | Follow-up |
|---|---|---|---|
| `profiles(user_id, language, plan, deletion_requested_at)` | `profiles` with primary key named `id` | Partial; `plan` and `deletion_requested_at` absent; PK naming differs | Choose a safe compatibility migration before application code depends on the final name |
| `subjects(id, user_id, name, exam_date)` | `subjects` | Partial; `exam_date` absent | Add in the Planning slice |
| `tasks(id, user_id, subject_id, title, note, due_at, priority, est_minutes, status)` | `tasks` | Partial; `note` absent | Add in the Planning slice |
| `focus_sessions` | `focus_sessions` | Present; verify all SPEC fields and constraints during migration inventory | Test task ownership and time constraints |
| `documents(... sha256, page_count, kind, status, failed_reason, attempts, locked_at, processed_at)` | `documents` | Partial; audit reports the processing/dedup fields absent | Add with the document lifecycle slice |
| `document_pages` | No corresponding public table reported | Missing | Add page text storage with user ownership and composite FK |
| `summaries` | No corresponding public table reported | Missing | Add in the summary slice |
| `quizzes` | `quizzes` | Present but verify fields, ownership and lifecycle against SPEC | Retain client read-only access |
| `questions` | `quiz_questions` | Naming/model difference; existing question table has legacy name | Decide compatibility mapping before frontend/API work; don't rename blindly |
| `question_keys` (server-only) | `private.question_keys` | Present; default-deny client access is intentional | Preserve server-only access and verify function privileges |
| `quiz_attempts` | `quiz_attempts` | Present, but current RPC behavior does not implement full attempt/session flow | Align schema and RPC with attempt-per-quiz model |
| `attempt_answers` | No corresponding table reported | Missing | Add; writes only through grading function |
| `ai_usage_logs` | `ai_usage_log` | Partial/name difference; lacks request key, status, credits, result ref, prompt version per audit | Add idempotency/accounting fields and decide naming compatibility |
| `usage_counters` | No corresponding table reported | Missing | Add for daily/monthly credit accounting |
| `spend_counters` | No corresponding table reported | Missing | Add for global spend reservation/settlement |
| `usage_limits` | No corresponding table reported | Missing | Add as server-managed configuration |
| `credit_costs` | No corresponding table reported | Missing | Add as server-managed configuration |
| `app_config` | No corresponding table reported | Missing | Add as server-managed configuration |

## 2. Policy, behavior, and operational gaps

| Area | Approved SPEC expectation | Observed state from audit | Required action |
|---|---|---|---|
| RLS | Enabled on every user-content table; flat user ownership checks | RLS enabled on all 10 observed public tables; question key table has no client policies by design | Keep; rerun catalog check after every migration |
| Cross-user links | Composite FKs on parent/user pairs | Audit reports these on current relationships | Preserve and extend to all new user-content tables |
| Client writes | Server-only for documents, pages, summaries, quizzes, questions, keys, attempts, logs and counters as specified | Client write restrictions exist on several server-managed tables; storage still permits direct object writes in own folder | Move uploads to server-mediated flow and remove direct-write path when signed upload is tested |
| Storage bucket | Private; short-lived signed downloads; SPEC starting limit 20 MB | Private bucket, 50 MB; folder policies allow client writes in own prefix | Align size limit and implement server-mediated upload/download boundary |
| Document state | `uploaded → processing → ready → failed` in TASKS and §5.4 | Live state includes `uploaded/processing/ready/failed`; §6 currently says `completed` | Standardize docs on `ready` or another explicitly chosen value before lifecycle code |
| Grading | Answer key never exposed before submission; answer belongs to an attempt | Key isolation exists; current `submit_answer(question_id, chosen_option)` records a submission without the SPEC `attempt_id` / `attempt_answers` workflow | Redesign RPC + schema before quiz UI integration |
| Repeat submission | Retry creates a new attempt | Same question can currently be submitted repeatedly and answer is returned each time | Enforce attempt/session semantics; test duplicate and replay behavior |
| Subject deletion | SPEC says cascade to tasks/documents/quizzes | Current behavior reportedly uses `SET NULL` for some child relations | Align to approved SPEC with an explicit impact review |
| Account deletion | Remove DB rows, Storage objects, and Auth user; idempotent retry | DB cascades exist; Storage objects are not removed by DB cascade | Build privileged deletion function and real Storage integration test |
| AI usage | Atomic reserve/settle/refund, idempotency, daily/monthly counters, global cap | Current log table lacks the required reservation/accounting fields and supporting counter/config tables | Implement after schema design; test concurrency with mock provider |
| Rebuildability | Repository migration history reproduces live database | Five foundation SQL files missing; one migration filename/version discrepancy | Recover exact source SQL and reconcile history before relying on clean rebuild |

## 3. Test coverage status

- **Recorded by Claude, not independently rerun by ChatGPT:** 115 PASS / 3 FAIL on the audited baseline; 118 PASS / 0 FAIL with the proposed local fix. The proposed-fix run is not evidence that the live database needed or still needs that fix.
- **Independently confirmed by ChatGPT through read-only live inspection:** live migration history contains `20261105073535 fix_submit_answer_ambiguous_created_at`; live function uses qualified `qa.id, qa.created_at`. The audit report's “not applied” statement is stale.
- **Not yet covered by the local replica:** real Supabase Auth/JWT and PostgREST behavior, real Storage upload/signed URL/deletion behavior, deployed app flows, concurrent AI reservation under real function execution, and end-to-end PDF-to-quiz.
- **Platform constraint:** the current test runner is Linux/PostgreSQL 16-specific and requires root/runuser. It is not a PowerShell-native Windows command. A WSL2 path must be tested and documented before recommending it for the owner's machine.

## 4. Suggested migration order

1. Recover and reconcile migration provenance; produce a reproducible baseline.
2. Add missing ownership-safe schema foundations and indexes for the next slice.
3. Add document lifecycle fields, page storage, storage boundary, and real Storage tests.
4. Add quiz attempt/answer schema and replace the current question-only submission flow.
5. Add AI usage/idempotency/counter/config schema and atomic functions.
6. Add Planning-only fields (`subjects.exam_date`, `tasks.note`) before the Planning vertical slice.

Keep each step additive and independently tested. Do not combine a large schema rewrite with UI feature work.

## 5. Explicit non-actions

No SQL was executed while preparing this matrix. No live database or user data was changed. No original migration SQL was fabricated. No branch was merged.
