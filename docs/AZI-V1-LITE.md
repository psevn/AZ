# AZ Intelligence — AZI V1 Lite (proposal)

**Status:** PROPOSAL, pending owner approval and technical review. Not implemented. Does not change approved V1 scope until PSEVN approves it.
**Owner decision on record (2026-11-15):** AZI is necessary in V1, should be connected to the app's existing areas, and must cost as little as possible. Deeper AI is developed later.
**Source of vision:** the three-phase AZI vision (text, then voice and visual, then shared digital workspace). This document covers only the V1 slice of Phase 1.
**Rules inherited from:** `docs/product/AZ-INTELLIGENCE-IDENTITY.md` and `CLAUDE.md`. Where this file disagrees with them, they win.

## 1. Goal
In V1, AZI is a supportive academic companion that uses the student's own data to say, with evidence, what needs attention, prepare a short practice quiz, and offer to schedule it. The "care" comes from data, rules and message templates. The AI API is used only where language generation is required.

## 2. Principle: rules first, AI only for language
| Function | Method | API cost |
|---|---|---|
| Academic memory (subjects, exams, attempts, mistakes) | Database tables, each fact with a status | none |
| Weak-topic detection | SQL over answer results grouped by topic | none |
| Recommendation message | Localized templates (AR/EN) filled with real numbers | none |
| Check quiz for tomorrow | Assembled from questions already stored | none |
| Scheduling and follow-up | Scheduled backend job + Planning task, with student approval | none |
| Readiness estimate | Simple formula, shown with its evidence and uncertainty | none |
| New question generation, summaries, Ask | AI API through the credit system | metered |

If the stored question bank for a weak topic is too thin, offering new questions is a paid, credit-metered action (see `PRICING.md`).

## 3. The care loop
1. **Observe.** Every graded answer is stored with its question's topic and source page.
2. **Detect.** A topic counts as a weak spot when the student has enough attempts on it and a low success rate. Thresholds are placeholders (for example at least 5 answers and under 60% correct) and are tuned during beta.
3. **Explain.** AZI shows a message with its evidence, for example: "In Statistics you missed 4 of 6 questions on hypothesis testing (pages 12–15)." No claim beyond the evidence.
4. **Prepare.** AZI builds a short check quiz (about 5 questions) from stored questions: previously missed ones plus unseen ones from the same topic.
5. **Propose.** "I prepared a short quiz for tomorrow. Add it to your plan?" Nothing is added to Planning without the student's approval.
6. **Follow up.** After the quiz, AZI shows the result against the earlier rate, for example from 33% to 67%, using real numbers only.

## 4. Cold start
A new student has no data, so AZI cannot name weaknesses. The first-run experience must create data: a short diagnostic quiz on an uploaded file, or solving the questions of the first generated quiz. Until a topic has enough evidence, AZI says so plainly and offers to practice instead of guessing.

## 5. Trust rules (from the identity document)
- Every insight states its evidence and the data behind it; limited data is stated as limited.
- Wording is "based on your answers", never "I know your level".
- No claim to predict a professor's real exam.
- At most one proactive insight per day. Insights are dismissible, and the student can turn proactive behavior off.
- In-app only in V1. No notifications outside the app.
- No claims in product copy or promo material about capabilities that are not demonstrably implemented.

## 6. Data model (observed in the live Supabase project `AZ` on 2026-11-15, plus proposals)
Already present in the live schema: `quiz_questions` has `topic` (nullable text), `source_page` and `difficulty`; `flashcards` has `topic` and `source_page`; `attempt_answers` stores `is_correct` per answer; `attempt_questions` links an attempt to specific questions; `tasks`; `subjects` (with `exam_date`); `focus_sessions`; `profiles.plan` (free or pro). The tables hold almost no data yet, so nothing here is validated.
Naming drift: `SPEC.md` §5 says `questions` and `question_keys`, while the live names are `quiz_questions` and `private.question_keys`. Reconcile the docs.
The `topic` label comes from the same generation call that produces the question, so it adds no extra API call. Its quality is a Stage C metric.
Proposed additions (review before any migration):
- `azi_insights(id, user_id, kind, subject_id, topic, evidence jsonb, status[proposed|accepted|dismissed|expired], created_at, expires_at)`: keeps evidence, supports dismissal and the daily limit.
- `azi_settings(user_id, proactive_enabled, max_per_day, nickname)`: nickname is optional and low priority.
- All new tables carry `user_id` and follow the same RLS pattern as the rest of the schema.

## 7. Open design questions (for Claude/ChatGPT review)
1. How a check quiz reuses existing questions. In the live schema `quiz_questions` belongs to one quiz, but `attempt_questions` links an attempt to arbitrary question ids, and `quiz_attempts` requires a `quiz_id`. A check quiz could therefore be a new `quizzes` row plus an attempt whose `attempt_questions` point at existing questions, with no copying. Verify against the attempt-start and grading functions before relying on it.
2. Where does the topic list for a subject come from: free text from the model, or a controlled list per subject? Free text will fragment ("hypothesis testing" vs "hypothesis tests").
3. Which Planning table and fields receive an approved check quiz?
4. Whether the scheduled job runs on Supabase scheduled functions or another mechanism. Verify Edge Function and scheduling limits on the current plan.

## 8. Priorities
- **P0 (needs Stage C first):** topic and page filled per question at generation (columns already exist); weak-topic detection; evidence message template; check quiz from stored questions; approval before scheduling.
- **P1:** follow-up result comparison; daily limit and off switch; diagnostic quiz for cold start.
- **P2:** nickname customization; readiness estimate; richer message variety.

## 9. Out of scope for V1
Voice, visual solution demos, shared digital workspace, push or email notifications, embeddings or free-form long-term memory, AI-written insights, specialized agents, and the AZI character artwork (not yet generated or approved).

## 10. Success criteria (to be measured in beta)
- Share of shown insights accepted versus dismissed, and share of students who disable proactive mode.
- Check quiz completion rate.
- Change in accuracy on a weak topic before and after a check quiz.
- Share of insights with correct topic labels (manual review in beta).
- API cost per active student, with AZI adding no metered calls except explicit generation.
All targets are undefined until beta data exists.

## 11. Dependencies and risks
- Depends on Stage C: wrong topic labels or weak questions make AZI say wrong things, which harms trust more than it helps marketing.
- Scope risk for a solo builder at 12.5–15 hours per week: connect AZI to data that V1 already builds (attempts, mistakes, exams, Planning) instead of adding a feature per area.

## 12. Group Projects: leader view (proposal)
Owner request (2026-11-15): AZI should help a group Project leader see who has submitted, who has not, and who has finished part of their share.

**What the live schema already supports** (observed 2026-11-15): `project_members.role` is `lead` or `member`; `project_tasks` has `assignee_id`, `status` (todo, doing, done), `due_at`; `project_activity` records events such as task completed and status changed. This is enough for a status panel with no new tables and no API cost.

**Definitions (proposal):**
- "Submitted" means the member's assigned tasks are all `done`.
- "In progress" means at least one assigned task is `doing`.
- "Not started" means all assigned tasks are `todo`.
- "Finished half of their part" is derived, not guessed: split a member's share into several tasks, then half means about half of them are `done`. There is no percent-complete field in the schema, and none is needed if shares are split into tasks.
- If nobody has updated a status, AZI says "no update", never an estimate.

**Privacy rules (non-negotiable):**
- AZI reads only `project_*` data for this view. Never a member's private quizzes, mistakes, weak topics, focus time or files.
- Each member can see what the leader sees about them.
- Neutral wording ("not submitted yet"), no shaming language.
- A reminder to a member is drafted by AZI and sent only after the leader approves; the member sees who sent it and can dismiss it.

**Open questions:**
1. Delivery of reminders: the schema has no notifications table. In-app only, for example through `azi_insights` rows written by a server function that checks the sender is the project leader.
2. Whether leader approval is needed for every reminder or can be a standing setting (default: every reminder).
3. Optional AI use (drafting a message, summarizing project status) is metered and charged to the user who triggers it.
