# AZ — V1 Specification (v0.2, Stage A)

Status: DRAFT v0.2 — incorporates the ChatGPT review relayed by PSEVN on 2026-11-04. Changes marked **[v0.2]** need PSEVN's explicit approval before they count as decided. Nothing is built. Items marked **[VERIFY]** depend on current provider terms/prices and must be checked on the official page first.

## 1. Product

AZ is an AI academic platform for university students. V1 closes one loop, with every feature reading/writing the same data:

**Plan → Study → Practice → Review mistakes → Improve**

Positioning: "The Life Operating System, starting with students." V1 covers Academic only. Web-first (responsive + installable PWA), Arabic/English with RTL from day one, dark mode first-class. Market: Qatar university students first.

## 2. V1 scope (unchanged)

In:
- Auth + strict per-user data isolation.
- Subjects, tasks, deadlines/exams, priority, estimated duration (manual).
- Focus timer linked to a task; sessions logged on the task.
- Document library: PDF upload, text extraction with page numbers.
- AI summary with source page references.
- Multiple-choice question generation: correct answer, explanation, page reference. If the material does not support a question, say so.
- Attempts, results, retry, mistake review list.
- Professional Mode: practice built from the user's own private slides/past exams (never shared; never claim to predict the real exam).
- Ask (questions about a document), small usage limit.
- Home: today's tasks, progress, countdown to next exam (reads existing data only).
- Usage credits (daily + monthly), per-call cost logging, global spend cap.
- Account page: language, remaining usage, delete account (full deletion incl. files).
- Groups: "Coming soon" card only.

Out (deferred): Mini Notebook, short-answer questions, advanced charts, real Groups, Arena, Community, XP, AZ Card, stylus handwriting, AI rescheduling, voice/photo schedule input, native apps, payments, ambassador program (post-beta).

Priorities if time runs short (nothing is removed from V1 now; see §11).

## 3. How features connect

- Subject owns tasks, documents, exams.
- Task ↔ focus sessions.
- Document → pages → summary → quizzes → questions → attempts → answers.
- Wrong answers feed Mistake Review; retry creates a new attempt.
- Exam date on a subject drives the Home countdown.
- Every AI call spends credits and writes one `ai_usage_logs` row.
- Home stores nothing of its own; it is a view over the above.

## 4. Architecture

### 4.1 Backend choice — Workers vs Edge Functions **[v0.2, recommendation, was open decision #4]**

Verified from official docs on 2026-11-04 ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Edge Functions limits](https://supabase.com/docs/guides/functions/limits)):

| | Cloudflare Workers (Free) | Cloudflare Workers (Paid) | Supabase Edge Functions |
|---|---|---|---|
| CPU per request | 10 ms | up to 5 min (default 30 s) | 2 s (excludes async I/O such as waiting for the AI) |
| Memory | 128 MB | 128 MB | 256 MB |
| Wall-clock | no limit on HTTP | no limit on HTTP | Free 150 s; Paid 400 s |
| Requests | 100,000/day | no limit | invocation quota **[VERIFY]** |
| Needs paid plan | no | yes (price **[VERIFY]**) | no (quota **[VERIFY]**) |
| Notes | Waiting on the AI provider is I/O, but parsing a PDF or large JSON can exceed 10 ms | — | Libraries needing multithreading (sharp/libvips) unsupported; 20 MB bundle limit |

Recommendation: **Supabase Edge Functions as the only backend; Cloudflare used for static hosting of the frontend.** Reasons: (1) PDF text extraction and AI response handling do not fit 10 ms CPU on the free Workers plan, and the paid plan is a new subscription with no economic justification yet; (2) one fewer vendor/runtime/secret store for a beginner; (3) functions sit next to the database, with built-in JWT verification and a natural place for the atomic Postgres functions below. Trade-offs: 2 s CPU may be too tight for large Arabic PDFs → tested in Stage C; fallbacks in §6. If tests fail, fall back to client-side extraction (pdf.js in the browser, server validates size/page limits) before considering a paid Workers plan.

| Layer | Choice | Rejected alternatives |
|---|---|---|
| Frontend | React + TypeScript (Vite), responsive PWA, hosted on Cloudflare (static) | Next.js (heavier, more concepts); Flutter/React Native (native apps deferred) |
| Backend | Supabase Edge Functions | Workers (limits above); Calling AI from browser (leaks keys) |
| Database/Auth/Storage | Supabase Postgres + Auth + private Storage bucket, RLS on every table | Firebase (NoSQL, lock-in); self-hosted Postgres (ops burden) |
| AI | Provider-independent interface (§8) | Hardcoding one provider |

Region: Supabase Mumbai (ap-south-1) for V1; revisit for V2 after legal advice.

```
Browser (PWA) ──JWT──► Edge Function ──► AI provider (key in function secrets only)
                          │
                          ├─ user-scoped client (caller's JWT; RLS applies)
                          └─ service client (only in privileged functions, see §5.3)
                          ▼
                Supabase: Auth │ Postgres (RLS) │ Storage (private)
```

## 5. Data model and isolation

### 5.1 Rule **[v0.2]**
**Every user-content table carries `user_id`** (denormalized), including `document_pages`, `summaries`, `questions`, `question_keys`, `quiz_attempts`, `attempt_answers`. RLS is then a flat, indexed check `user_id = auth.uid()` with no joins in policies (joins in policies are slower and easy to get wrong). Config tables (`usage_limits`, `credit_costs`, `app_config`) have no `user_id` and are not client-writable.

### 5.2 Cross-user link prevention **[v0.2]**
Each parent table has `UNIQUE (id, user_id)`; each child uses a **composite foreign key** `(parent_id, user_id) REFERENCES parent (id, user_id) ON DELETE CASCADE`. A row can therefore never point at another user's parent, even if the ID is known or guessed. Client policies:
- Client read/write (own rows): `subjects`, `tasks`, `focus_sessions` (write only; FK-protected).
- Client read-only (own rows): `documents`, `document_pages`, `summaries`, `quizzes`, `questions`, `quiz_attempts`, `attempt_answers`, `ai_usage_logs` (limited columns), `usage_counters`.
- No client access at all: `question_keys`, `spend_counters`, `app_config`, `credit_costs` (RLS enabled, zero policies).
- All other writes happen only in server functions.
- Storage: private bucket; object path `{user_id}/{document_id}.pdf`; storage policies restrict to own prefix; downloads via short-lived signed URLs created server-side.

### 5.3 Using server privileges safely **[v0.2]**
- Default: a **user-scoped client** built from the caller's JWT, so RLS applies.
- A **service-role client** is used only in named privileged functions (grading, credit reserve/settle, deletion, document processing). Rules: `user_id` always comes from the verified JWT (`auth.getUser`), never from the request body or query; every query in a privileged function filters by that `user_id`; the service key lives only in function secrets; reviewed in each stage's ChatGPT review.
- Test: every privileged function rejects a request whose body names a different user/object id.

### 5.4 Tables
- `profiles(user_id PK, language, plan, deletion_requested_at)`
- `subjects(id, user_id, name, exam_date)`
- `tasks(id, user_id, subject_id, title, note, due_at, priority, est_minutes, status)`
- `focus_sessions(id, user_id, task_id, started_at, ended_at, minutes)`
- `documents(id, user_id, subject_id, title, storage_path, sha256, page_count, kind[slides|notes|past_exam|other], status[uploaded|processing|completed|failed], failed_reason, attempts, locked_at, processed_at)`
- `document_pages(id, user_id, document_id, page_no, text)`
- `summaries(id, user_id, document_id, content, source_pages[], provider, model, prompt_version)`
- `quizzes(id, user_id, document_id, mode[standard|professional], created_at)`
- `questions(id, user_id, quiz_id, text, options jsonb, source_page)` — **no answer here**
- `question_keys(question_id, user_id, correct_option, explanation, evidence_quote)` — server-only
- `quiz_attempts(id, user_id, quiz_id, score, started_at, finished_at)`
- `attempt_answers(id, user_id, attempt_id, question_id, chosen_option, is_correct)` — inserted only by the grading function
- `ai_usage_logs(id, user_id, feature, request_key, status[reserved|succeeded|failed|refunded], provider, model, prompt_version, tokens_in, tokens_out, est_cost, credits_reserved, credits_charged, latency_ms, result_ref, created_at)` with `UNIQUE (user_id, feature, request_key)`
- `usage_counters(user_id, period_type[day|month], period_start, credits_used)` PK on all three
- `spend_counters(month PK, reserved_cost, settled_cost)`
- `usage_limits(plan, daily_credits, monthly_credits)`, `credit_costs(feature, credits)`, `app_config(global_monthly_cost_cap, max_reserved_age_minutes, …)`

Deleting a subject cascades to its tasks/documents/quizzes (confirm dialog; tested). Storage objects are not removed by DB cascade — see §9.

### 5.5 Isolation tests (Stage B gate) **[v0.2]**
- For every table and every operation (select/insert/update/delete) with user B's JWT against user A's ids: no rows returned / rejected.
- Insert a child row with B's `user_id` but A's `parent_id` → rejected by the composite FK.
- Anonymous (no JWT) access → rejected.
- Storage: B cannot list/read/write under `{A}/`.
- Automated check that every table in `public` has RLS enabled (query catalog + Supabase advisors).
- Check `question_keys` and server-only tables return nothing to any client.

## 6. PDF processing **[v0.2]**

- Status machine: `uploaded → processing → completed | failed` (+ `failed_reason`, `attempts`, `locked_at`).
- Atomic claim (prevents duplicate processing): `UPDATE documents SET status='processing', attempts=attempts+1, locked_at=now() WHERE id=? AND user_id=? AND status IN ('uploaded','failed') AND attempts < max RETURNING *`; no row returned → another worker owns it, do nothing.
- Retry: max 3 automatic attempts, then `failed` with a readable reason and a manual retry button (resets attempts). A scheduled sweep resets `processing` rows older than `max_reserved_age_minutes` back to `failed`/`uploaded`.
- Dedup: `sha256` per user; the same file is not processed or paid for twice.
- Limits (configurable; start 20 MB / 80 pages); image-only PDFs rejected with a clear message (low text density per page).
- Runtime limits: Edge Functions give 2 s CPU / 256 MB / 150 s wall-clock (Free). Whether an 80-page Arabic PDF parses within 2 s CPU is **unknown — must be measured in Stage C**. Arabic PDFs can produce reversed/garbled text depending on how the PDF was created; tested separately with real course files, and documents with poor extracted text are flagged `failed` with a reason. Fallback order: lower page limit → client-side extraction (pdf.js) → process in chunks (page ranges) → only then consider a paid compute option (requires PSEVN approval).

## 7. Quiz security and grading **[v0.2]**

- The browser never receives `correct_option` or `explanation` before answering. Generation stores questions in `questions` and answers in `question_keys` and returns questions without keys.
- Grading happens server-side: `submit_answer(question_id, chosen_option)` verifies ownership, records `attempt_answers` (clients cannot insert them), and only then returns `is_correct`, correct option, explanation, source page.
- Mistake review returns correct answers only for questions the user has already answered. Retry creates a new attempt; score is computed on the server.
- Tests: no API response or table readable by the client contains an answer key before submission; a forged score/answer insert is rejected.

## 8. AI layer

### 8.1 Provider independence **[v0.2]**
Features call an internal interface, never a provider SDK: `AIProvider.summarize(...)`, `.generateQuiz(...)`, `.answer(...)`. Each provider adapter maps to a common input/output schema, validates output against a JSON schema, and returns normalized usage (tokens in/out). Prices come from config. Prompts are versioned files (`prompt_version` logged). Switching OpenAI ↔ Gemini changes an adapter + config, not feature logic. Test: same inputs through two adapters (mock + real) satisfy the same schema.

### 8.2 Quality measured next to cost **[v0.2]**
Fixed evaluation set (real course PDFs incl. Arabic) run per provider/model/prompt version. Metrics:
- Usable questions % (PSEVN's manual review, 20 per PDF).
- Answer correctness and explanation quality (manual).
- Page-reference accuracy: every question returns `evidence_quote`; server checks the quote appears in the cited page text (automatic) plus manual spot check. *(Automatic check = recommended improvement.)*
- Schema-valid rate; "not enough support" rate on deliberately unsupported prompts.
- Latency; cost per quiz; **cost per usable question**.

## 9. Credits, idempotency, spend cap **[v0.2]**

Atomic operations are Postgres functions (single transaction), called by the Edge Function:

1. `reserve(user, feature, request_key)`: insert/claim the `ai_usage_logs` row `status='reserved'` (unique on user+feature+request_key). Lock the user's counter rows (`FOR UPDATE`), check `used + reserved ≤ daily` and `≤ monthly`, check global `spend_counters` against `global_monthly_cost_cap` (reserve the worst-case estimated cost), then increment. Fails → no provider call.
2. Provider call happens **only for the request that won the transition to `reserved`**.
3. `settle`: set `succeeded`, store `result_ref`, replace reserved credits/cost with actual, update counters.
4. `refund`: on provider error/timeout/invalid output → `failed`, release reserved credits and cost.
5. Sweep (scheduled): rows stuck in `reserved` longer than `max_reserved_age_minutes` → refunded.

Idempotency: same `request_key` after `succeeded` → return stored `result_ref` (no provider call, no charge); while `reserved` → return "in progress" (no call); after `failed` → client may retry with the same key (atomic transition `failed → reserved`) or a new key. Double-click and network retries therefore never trigger a second provider call.

Concurrency tests (use a mock provider that counts calls):
- 50 parallel requests, same `request_key` → provider mock called exactly once.
- 50 parallel requests, different keys, user cap = N credits → at most N credits' worth charged; rest rejected.
- Global cap set low, many users in parallel → total reserved+settled never exceeds cap (margin = single largest estimate, documented).
- Provider failure → credits fully refunded; killed function mid-call → sweep refunds.
Costs are estimates; reconcile weekly with the provider dashboard; set a provider-side limit as a second layer if available **[VERIFY]**.

Limits and prices live in config tables. Subscribers get higher daily/monthly caps, never unlimited. Numbers stay blank until Stage C data.

## 10. Account deletion **[v0.2]**

DB cascade does not delete Storage objects, so deletion is an explicit, idempotent, re-runnable function:
1. Mark `deletion_requested_at`; block new uploads/AI calls.
2. List and delete all Storage objects under `{user_id}/` (paginated until none remain).
3. Delete user rows (cascade from `profiles`/`subjects`); delete or anonymize `ai_usage_logs` (default: delete per-user rows, keep only aggregated cost totals — confirm with legal advice).
4. Delete the Auth user.
5. If any step fails, the request stays pending and retries; the user sees status.
Backups may retain data for a provider retention window — state in the privacy policy (**legal review**).

Test: create a user with rows in every user table and several files; delete; assert zero rows in every user table, zero objects under the prefix, Auth user gone, and another user's data untouched.

## 11. Security summary
- RLS + composite FKs (§5); server-side grading (§7); prompt-injection: document text is data, never instructions, tested with hidden "ignore previous instructions" text.
- Secrets only in function secrets/Cloudflare env; `.env` in `.gitignore`; never in browser or chat.
- Abuse: beta invite code; later verified university email + bot check (Cloudflare Turnstile **[VERIFY]**); country restriction only an optional extra layer.
- Minors: V1 targets university students; school programs only after legal review.
- Legal (needs a professional, not verified): Qatar registration for subscriptions, personal data protection law, payment gateway supporting Qatar, app-store rules.

## 12. Scope priorities and delivery **[v0.2]**

Delivery is by **vertical slices**: each slice runs from UI → API → database and ends with a real test from the interface. No stage closes on "backend done, UI later".

Priority tiers (no feature removed from V1 now; this is the cut order if we slip):
- **P0 — never cut:** auth + isolation; PDF → quiz → server grading → mistake review with page refs; credits, logging, spend cap; account deletion; security tests.
- **P1:** Planning (tasks/subjects/exams), Focus timer, library, summaries, Professional Mode, account page.
- **P2 — cut first, in this order:** Home polish/countdown extras → Ask → anything marked nice-to-have in a stage. (Mini Notebook and short answers are already outside V1.)

Dates are targets, not promises: launch is gated by quality gates (tests passing, security review, beta results). If the gates are not met, the date moves; quality does not. Time estimates are draft and re-planned after the first slice using real hours.

## 13. Pricing (assumption, not final)
Free tier + Pro $6.99/month; $4.99 for the first 500 students (3 vs 6 months undecided). Payments deferred. Caps blank until Stage C. Margin check at the subscriber's full cap, including the $4.99 price.

## 14. Versions
V1.0 beta → web launch (target early Feb 2027); V1.1 beta fixes + deferred items; V1.2 payments (after legal check); V1.3 real Groups; V2.0 GCC/North Africa + native-app decision (only when: weekly usage proven, a need the PWA can't meet, revenue justifies maintenance; cheapest route is wrapping the web app, e.g. Capacitor, verify then). Design now: responsive UI, API separate from frontend.

## 15. Working process
Spec/criteria per stage → Claude Code implements → push to GitHub with a test report (changes, what was tested, results) → ChatGPT reviews (security, permissions, cost; repo link or pasted files; PSEVN relays) → fixes → next stage only when tests pass. No architecture change without review; no paid services without approval; "works" only with a test that ran.
