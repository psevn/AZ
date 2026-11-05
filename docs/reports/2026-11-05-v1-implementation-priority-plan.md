# AZ V1 — Prioritized implementation plan

Date: 2026-11-05  
Basis: approved `docs/SPEC.md` v0.2, `docs/TASKS.md`, `docs/DECISIONS.md`, current `docs/IMPLEMENTATION_STATUS.md`, Claude's live-schema audit, and the independent ChatGPT review.  
Status: working plan for owner review. This document does not change V1 scope, approve a migration, or authorize live database changes.

## Executive direction

Continue with the approved V1 vertical-slice sequence. Do not start broad UI feature work or add new product scope yet. The next engineering objective is to make the existing foundation reproducible and testable, then complete one real PDF-to-quiz learning loop.

**Immediate next milestone:** Stage B acceptance evidence, not another scaffold. The local React/Vite build and dev server were run by the owner, but browser auth, real-user isolation, deployed PWA, and end-to-end acceptance remain unverified.

## Priority 0 — Resolve foundation truth before extending it

### B0. Repository and migration provenance
- [ ] Recover the exact five original foundation migration SQL files from the original authoring environment. Do not reconstruct them from the live schema and label them original.
- [ ] Reconcile the live migration history entry `20261104145805` with the repository filename `20261104145802_index_private_question_keys_owner_fk.sql`. Verify exact SQL and provenance; do not rename or replay based on the filename alone.
- [ ] Reconcile the live `submit_answer` hotfix: the live project already records migration `20261105073535` and the function uses qualified `qa.id, qa.created_at`. Preserve the exact applied SQL and record the correct version in repository history. Do not replay the proposed fix.
- [ ] Update implementation-status documentation only after checking the current local build facts and current live migration state.

**Gate:** the repository's migration history accurately distinguishes original migrations, reconstructed snapshot, and later applied migrations. A clean rebuild is reproducible, or the remaining limitation is explicitly documented.

### B1. Stage B walking skeleton acceptance
- [ ] Run the local app from the repository root and verify browser rendering on the owner's Windows machine.
- [ ] Configure local environment using the publishable Supabase key only; verify no service-role key or AI secret is present in the browser bundle or Git history.
- [ ] Test sign-up, sign-in, session persistence, sign-out, and create/list subject through the real UI.
- [ ] Test two real authenticated users: each sees only their own subject rows; cross-user access and forged writes fail.
- [ ] Complete invite-code gating and the agreed app shell/navigation; verify Arabic/English, RTL/LTR, dark mode, responsive layout, and installability.
- [ ] Deploy the static frontend and verify the deployed URL, auth redirect URLs, and PWA installation.
- [ ] Implement the credit reserve/settle/refund skeleton and sweep only to the extent required by the approved Stage B acceptance criteria; test with a mock provider, including concurrency and refunds.

**Gate:** Stage B acceptance criteria in `docs/TASKS.md` pass with a written test report. Existing database migrations alone do not close Stage B.

## Priority 1 — Close the schema gaps needed for the first useful learning loop

Do this as reviewed, additive, narrowly scoped migrations, one slice at a time. First produce a schema-to-SPEC matrix with columns: SPEC requirement, live object, difference, migration needed, test.

### C0. Data model alignment
- [ ] Map the current ten public tables and private schema to every table/column in SPEC §5.4.
- [ ] Add only the missing V1 objects/columns required for the upcoming vertical slice: document pages, summaries, attempt answers, usage counters/log fields, spend counters/configuration, and the required ownership/composite-FK structure.
- [ ] Resolve the naming mismatch `profiles.id` vs SPEC `profiles.user_id` before app code relies on either.
- [ ] Resolve `documents.status` vocabulary: SPEC §5.4 and TASKS use `ready`; SPEC §6 currently says `completed`. Prefer one canonical value across schema, function, tests, and docs before processing is implemented.
- [ ] Align subject deletion behavior with the approved SPEC cascade requirement. Review storage deletion separately because database cascades do not delete Storage objects.
- [ ] Keep the unused `notes` table out of the V1 UI. Do not perform a destructive drop merely to remove an out-of-scope table.

### C1. Upload boundary and document lifecycle
- [ ] Implement the SPEC's server-mediated upload flow and short-lived signed download URLs; current client Storage policies permit direct writes and therefore do not yet match the approved boundary.
- [ ] Align bucket/file limits with the SPEC starting values (20 MB / 80 pages), after verifying current bucket settings and testing rejection paths. Current audit reports a 50 MB bucket.
- [ ] Implement per-user SHA-256 deduplication, atomic processing claim, max-three retries, stuck-job recovery, and clear failure reasons.
- [ ] Test real Storage behavior: upload, MIME/size enforcement, signed URL access, unauthorized cross-user access, deletion, and cleanup.

**Gate:** a real user uploads a valid PDF; another user cannot access it; duplicate/retried processing does not create duplicate work; failure states are recoverable.

## Priority 2 — Stage C: prove PDF → quiz quality and economics

Implement in this order:
1. PDF upload and lifecycle.
2. Text extraction with page numbers, including Arabic and English samples.
3. Summary with cited source pages.
4. Quiz generation with evidence quote and page reference; reject unsupported questions.
5. Attempt/session model and server-side grading.
6. Mistake review and retry as a new attempt.
7. AI provider adapter interface and evaluation harness.
8. Credit accounting, idempotency, per-user limits, global spend cap, and failure refunds.

Required test evidence:
- [ ] Real course PDFs, including at least one Arabic PDF; small and large samples.
- [ ] Measure Edge Function CPU/memory and latency; use SPEC fallback order if limits are exceeded.
- [ ] Browser/API never exposes answer keys before submission.
- [ ] Grading is tied to a quiz attempt; forged scores/answers and cross-user IDs are rejected.
- [ ] Resolve the current repeated-submission behavior before quiz UI integration. Current `submit_answer(question_id, chosen_option)` does not yet represent the SPEC's `attempt_id` / `attempt_answers` flow.
- [ ] Prompt-injection text inside a PDF is treated as document data, not instructions.
- [ ] Same idempotency key ×50 concurrent requests results in one provider call; cap and refund tests pass.
- [ ] Compare at least two provider adapters on the same evaluation set; report usable-question rate, answer quality, page accuracy, schema validity, latency, cost per quiz, and cost per usable question.
- [ ] Owner manually reviews 20 questions per PDF and confirms they are good enough to study from.

**Gate:** PSEVN accepts the generated questions as genuinely useful for exam preparation; cost and quality are measured, not guessed.

## Priority 3 — Stage D/E: finish the connected student workflow

After the PDF-to-quiz loop passes:
- [ ] Planning: subjects, exam dates, tasks, due dates, priority, estimated duration, and task status.
- [ ] Focus: timer linked to a task; completed session is saved and visible.
- [ ] Home: today's tasks, simple progress, and next-exam countdown, all derived from existing records.
- [ ] Workspace: library, summaries, quizzes, attempts, mistake review, retry, Professional Mode.
- [ ] Ask with the approved small usage cap; defer if needed under the SPEC's P2 cut order.
- [ ] Account page and full account deletion, including Storage objects, with idempotent retries and a two-user deletion test.

## Priority 4 — Stage F: beta readiness

- [ ] Re-run deployed end-to-end isolation, upload, grading, credits, spend-cap, and deletion tests.
- [ ] Security review of RLS, composite FKs, privileged Edge Functions, secrets, uploads, prompt injection, and rate limits.
- [ ] Invite-code beta with 15–50 students; capture activation, retention, useful-question feedback, usage-limit behavior, and cost per active user.
- [ ] Legal review before charging; payments remain deferred.
- [ ] Keep unbuilt features clearly labelled as coming soon/concept.

## Explicitly not in this plan

No V1 scope expansion: no real Groups/community/Arena, Mini Notebook UI, short-answer questions, advanced charts, payments, native apps, AZ Connect, or Claude↔ChatGPT automation. Native apps remain the planned post-web phase. No paid subscription, domain purchase, or provider commitment is authorized by this plan.

## Decisions / clarifications to bring to PSEVN only when the relevant slice is reached

1. Confirm the canonical document terminal status (`ready` vs `completed`) because the approved documents currently conflict.
2. Confirm whether the existing unused `notes` table should simply remain dormant through V1; no drop is recommended now.
3. Revisit AI provider/model and spend cap only after Stage C quality/cost evidence. No provider purchase or subscription is implied.
4. Recover exact original migration SQL from the original workspace; this is a source-recovery task, not a product decision.

## Working rules

- One implementation agent per branch at a time; no simultaneous edits to the same files.
- Claude implementation work stays on its own branch; ChatGPT review/planning stays on a separate branch.
- Do not merge branches, deploy schema changes, or apply live SQL without explicit owner approval.
- Every claimed completion must link to an actual test and its result.
- This plan is subordinate to approved SPEC v0.2 and does not alter it.
