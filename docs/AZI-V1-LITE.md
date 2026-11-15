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

## 13. Question Engine (proposal)
Owner request (2026-11-15): produce quizzes, tests and flashcards with code and algorithms where possible, keep AI only where it is needed, and keep the student solving.

**Principle: AI generates content once per document; code runs everything after that.** One generation call per document returns questions (with topic, source page, explanation), flashcards and a summary together, so the input is paid for once (see `PRICING.md`). Everything below uses stored content and has no API cost.

| Function | Method | API cost |
|---|---|---|
| New session from the same bank | Pick about 10 questions weighted toward weak topics and unseen items, so each session differs | none |
| Flashcards | Derived from stored questions (question, answer, source page); no new call | none |
| Spaced review | Leitner boxes or SM-2: a missed item returns soon, a correct one returns later | none |
| Mock exam | Assemble from the bank by topics, difficulty and time limit | none |
| Mistake review | Re-serve only the student's missed questions | none |
| Distractors | Reuse correct answers of other questions in the same topic where they fit (quality to be checked in Stage C) | none |
| Parameterized numeric questions | A stored template (text with variables plus a formula); code randomizes values and computes the answer. Suits quantitative courses (accounting, economics, statistics) | none per question; templates must be authored |

**What still needs AI:** turning document text into good questions, explanations and page references. Rule-based extraction (definitions, bold terms) can be tried as an experiment, but quality, especially in Arabic, is unverified and it is not a V1 dependency.

**Bank exhaustion:** a student who masters the stored questions needs new ones. Generating more is the metered, paid action (credit system). Parameterized templates postpone that moment for numeric subjects.

**Keeping the student solving (all rule-based, no AI):**
1. A short daily session (about 5 minutes) assembled from items that are due for review.
2. Missed items return later until answered correctly (spaced review).
3. A visible mastery figure per topic that moves after each session, shown with its evidence (counts of answers).
4. Link to the exam date: days left and the number of sessions that fit.
5. A streak that does not reset to zero after one missed day.
All numbers (session length, box intervals, thresholds) are placeholders to tune in beta.

**Schema notes (review before any migration):**
- Spaced review needs per-student, per-question state (box or interval, next due date). It can be derived from `attempt_answers` history, which avoids a new table but costs more at read time, or stored in a new table such as `review_schedule(user_id, question_id, box, due_at)`. Decision needed.
- Numeric templates need a place to live (a `question_templates` table, or a JSON column). This is a schema change, so it is not a Quick win and is proposed as a V1.5 experiment for one subject.
- Parameterized answers must be computed and graded server-side, like all grading (SPEC §7).

**Priorities:** P0 (after Stage C): sessions from the bank, mistake review, flashcards from stored questions. P1: spaced review, daily session, mock exam composer. P2: numeric templates, rule-based extraction experiment.

## 14. Study strategies AZI supports (proposal)
Owner request (2026-11-15): AZI should know the most suitable way for a student to study, so AZ needs a list of study strategies backed by evidence that the product can actually support.

**Evidence base used here (checked 2026-11-15):**
- Dunlosky et al. (2013), *Psychological Science in the Public Interest*, a review of ten techniques. Practice testing and distributed practice rated high utility; elaborative interrogation, self-explanation and interleaved practice rated moderate; summarization, highlighting, keyword mnemonic, imagery for text and rereading rated low. The authors state these are not a panacea and help motivated students who can apply them.
- Yan, Sana and Carvalho (2023/2024), a perspective piece summarizing meta-analyses: spacing g = 0.74 versus massed practice (Latimier et al., 2021); retrieval practice about g = 0.50 (classroom meta-analysis, Yang et al., 2021); interleaving g = 0.42 versus blocked practice (Brunmair and Richter, 2019). Heterogeneity is high for retrieval and interleaving. Stated limits: retrieval helps little without feedback or when too easy; worked examples can beat extra retrieval for learning a procedure; blocking can beat interleaving when concepts are easy to tell apart; too much spacing can fail; most studies used narrow, experimenter-made tests. The authors' conclusion is that no single strategy fits every learner, content type or context.
Both sources describe groups of learners, not an individual student. AZI must not present them as a prediction for a specific person.

| Strategy | Evidence rating | How AZ supports it | AI cost |
|---|---|---|---|
| Practice testing (quizzes, flashcards) | High | Core of the product (section 13) | stored bank: none |
| Distributed practice (spacing) | High | Spaced review and exam-date schedule | none |
| Interleaved practice | Moderate | Mixed-topic sessions; for numeric subjects, mix problem types | none |
| Self-explanation | Moderate | Prompt "why is this the answer?" after a missed question; explanation stored at generation | stored: none |
| Elaborative interrogation | Moderate | "Why is this true?" prompts on stored questions | stored: none |
| Worked examples (from Yan et al., for procedures) | Not rated in Dunlosky; supported as a limit of retrieval in Yan et al. | Show the stored worked solution before more retrieval on a procedure the student keeps missing | stored: none |
| Summarization, highlighting, rereading | Low | Not promoted as a way to learn; a generated summary is an orientation step before practice, not the study method | metered if generated |

**Product tension to decide:** AZ sells summaries, but the cited review rates summarization low and practice testing high. Proposed default flow: summary (orientation) then quiz, with copy that does not claim summaries alone improve learning.

**How AZI chooses what to suggest (rules, no AI):**
- Inputs are observable only: days to the exam, accuracy per topic, number of attempts, repeated misses on a question, whether the question type is numeric.
- Examples: exam far away leads to a spaced daily session; exam within days leads to a mock exam and mistake review; a procedure missed repeatedly leads to the worked solution first, then retry; a topic with too few answers leads to a diagnostic quiz instead of a guess.
- The message states why ("you missed this question twice"), says it is a suggestion, and the student can ignore it. No personality or learning-style claims.

**Open questions:**
1. Whether to adopt this list as the product's official strategy set, or review it against more sources first (two sources checked so far).
2. Per-subject differences (numeric versus text-heavy courses) are reasoned from the cited limits and not tested; measure in beta.
3. Whether a self-explanation prompt reduces session completion; measure before making it default.
4. Success measure: accuracy change on a topic after the strategy AZI suggested, versus no suggestion. Undefined until beta data exists.
