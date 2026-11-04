# AZ — Stages and Tasks (v0.2)

Method: each stage is delivered as **vertical slices** (UI → API → DB, with a real test from the interface). A stage closes only when its tests pass, a test report exists, and ChatGPT has reviewed security/permissions/cost.

Time (draft, re-plan after the first slice with real hours): ~12.5–15 h/week → roughly 150–190 h until early Feb 2027, minus exam periods (confirm dates). Dates are targets; quality gates decide the launch.

| Stage | Goal | Draft effort |
|---|---|---|
| A | Plan + approval | this week |
| B | Foundation (walking skeleton) | ~2 weeks |
| C | PDF → quiz experiment | ~3 weeks |
| D | Planning + Focus + Home | ~3 weeks |
| E | Workspace + Account | ~2 weeks |
| F | Security, testing, beta | ~2–3 weeks + buffer |

Cut order if we slip (nothing removed now): P2 first — Home polish → Ask. P0 never cut (see SPEC §12).

## Stage A — Plan
- [x] PSEVN approves SPEC v0.2 / DECISIONS v0.2 (the 8 proposed items) — approved 2026-11-04.
- [ ] 3–5 course PDFs prepared (≥1 Arabic) for Stage C.
- [x] Decide how Stage B gets built — initial scaffold/integration authored through the GitHub-assisted ChatGPT workflow; Claude Code remains deferred.
- [ ] Confirm old Supabase project deleted.

## Stage B — Foundation (walking skeleton slice: sign up → create subject → see it, deployed, with isolation proven)

> Progress note: Supabase database foundation/security is partial. The initial web scaffold and Auth/subjects code are committed, but have not yet been built or runtime-tested locally. Invite-code gating, complete navigation, deployment, credit RPCs, and end-to-end isolation/concurrency tests remain open. See `IMPLEMENTATION_STATUS.md`.
- [x] Initial repo scaffold, `.gitignore`, `.env.example`, README. No secrets are committed; Edge Function secrets will be configured when functions are introduced.
- [ ] Migration: all tables in SPEC §5.4, composite FKs, RLS policies, private storage bucket + policies.
- [ ] Auth + invite code; app shell (4 tabs, AR/EN + RTL, dark mode, responsive, PWA manifest); deploy.
- [ ] Credit RPCs (`reserve/settle/refund`) + sweep job skeleton, tested with a mock provider.
- Acceptance: isolation tests in SPEC §5.5 all pass; RLS-enabled check on every public table; keys absent from repo and browser bundle; app deployed and installable; mock-provider concurrency tests in SPEC §9 pass.

## Stage C — PDF → quiz experiment (decides quality and cost)
Slices: (1) upload + status machine, (2) extraction with page numbers, (3) summary with source pages, (4) quiz generation, (5) server grading + attempts.
- Upload: PDF only; configurable limits (start 20 MB / 80 pages); scanned PDFs rejected clearly; sha256 dedup.
- Status `uploaded/processing/ready/failed`; atomic claim; max 3 retries; stuck-processing sweep; double-trigger test processes once.
- Measure Edge Function CPU/memory on real PDFs (Arabic and English, small and 80-page); apply fallbacks in SPEC §6 if needed.
- Every question: correct answer, explanation, source page, evidence quote (checked automatically against page text); unsupported material → "not enough support".
- Browser never receives answer keys before submission; grading server-side; forged answers rejected.
- Provider interface with ≥2 adapters; evaluation run on the same PDFs; report usable % (PSEVN reviews 20 questions per PDF), page-ref accuracy, schema-valid rate, latency, cost per quiz, cost per usable question.
- Credits: concurrency tests (same key ×50 → one provider call; per-user cap; global cap; failure refund; killed function → sweep refund).
- Hidden "ignore previous instructions" text in a PDF does not change behavior; another user cannot read the document/quizzes/attempts.
- Output: filled credit-cost table + unit-economics sheet (cost per active user at the subscriber cap, incl. $4.99 price).
- Pass only if questions are good enough for PSEVN to study from before an exam.

## Stage D — Planning + Focus + Home
- [ ] Subjects/tasks/exams CRUD; focus timer linked to tasks (slice: create task → start focus → session saved → visible in Home).
- [ ] Home reads tasks, progress, countdown (no data of its own).
- [ ] Deleting a subject cascades (tested incl. storage objects).

## Stage E — Workspace + Account
- [ ] Library, summaries, quizzes, attempts, mistake review, retry.
- [ ] Professional Mode (private files only; no prediction claims).
- [ ] Ask with small limit; usage meter.
- [ ] Account deletion (SPEC §10) with full-deletion test: zero rows, zero storage objects, auth user gone, other users untouched.

## Stage F — Security, testing, beta
- [ ] Security review (RLS, storage, privileged functions, uploads, injection, secrets, rate limits).
- [ ] Re-run all isolation, grading, credit/cap and deletion tests on the deployed app.
- [ ] Invite-code beta with 15–50 students; track activation, retention, % hitting daily limit twice/week, cost per active user, usable-question feedback.
- [ ] Legal check before charging (professional).
- [ ] Waitlist/landing; unbuilt features labeled "concept / coming soon".

## Post-web phase — Android + iOS apps (planned next; not part of V1)
- [ ] Review web MVP stability, beta feedback, and mobile-specific user needs.
- [ ] Choose the implementation route (Capacitor vs React Native/Expo) based on reuse, native UX requirements, and maintenance cost; record the decision before coding.
- [ ] Build mobile-specific navigation and screens while reusing Supabase Auth, database, Storage, and Edge Function APIs.
- [ ] Test sign-in/session handling, data sync, file access, and core study flows on supported Android and iOS devices.
- [ ] Complete platform privacy, security, accessibility, and store-release checks before publishing.

## Accounts/decisions the owner handles personally
GitHub (repo AZ), Supabase, Cloudflare, AI provider account with a spend limit, domain (deferred), Claude Code access (deferred), legal advice. Never paste keys into chat.
