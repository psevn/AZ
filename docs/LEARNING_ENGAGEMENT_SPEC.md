# Learning Engagement System — Product & Technical Specification

Status: proposal / design-only
Scope: first healthy-engagement foundation for AZ
Parent workstream: Study Pack quiz loop and AZ Intelligence
Implementation status: not implemented by this document

## 1. Product intent

AZ should make it easier and more satisfying for students to return to meaningful study. The goal is **consistent learning and visible academic progress**, not compulsive use, screen time, or notification-driven retention.

"Positive learning addiction" is an informal metaphor only. It is not a product requirement or a target metric. AZ must support autonomy, competence, rest, and healthy stopping points.

The system is composed of three connected capabilities:

1. **AZ Progress System** — evidence-based progress, streaks, milestones, and skill progression.
2. **Daily Challenge** — one optional, achievable practice action grounded in the student's own study materials.
3. **AZI Motivation Layer** — calm, context-aware encouragement and next-step suggestions based only on observable evidence.

## 2. Non-negotiable principles

- Reward learning actions and demonstrated progress, never time spent, clicks, app opens, or notification responses.
- No guilt, shame, fear of missing out, punitive countdowns, or "you failed" language.
- Never remove earned points, achievements, or progress because a student rests, is ill, travels, or misses a day.
- A streak is descriptive, not a measure of intelligence, discipline, worth, or motivation.
- Rest days and skipped challenges are valid. No streak freeze purchase or paid recovery mechanic.
- Never fabricate progress, scores, mastery, streaks, or social proof.
- Every progress claim must be traceable to completed, user-scoped source events.
- Explain why a milestone or recommendation appeared; allow the student to dismiss or disable motivational prompts.
- Keep the core study workflow usable when engagement features are disabled or unavailable.
- Respect Arabic/English, RTL/LTR, accessibility, reduced motion, and low-performance devices.

## 3. V1 scope

### 3.1 AZ Progress System

V1 should ship only the smallest reliable progress model:

- Completed study sessions (not merely started sessions).
- Completed quiz attempts and answer counts.
- Correct-answer rate with sample size and time window.
- Reviewed mistakes, only when the student explicitly opens/reviews the explanation.
- Topic progress derived from sufficient completed answers.
- Current and longest study streak, using the student's configured academic timezone (default: Asia/Qatar).
- A small set of milestones for meaningful actions.

Do not ship a complex RPG economy, public leaderboard, competitive ranking, collectible marketplace, or major-specific skill tree in this first slice.

### 3.2 Daily Challenge

- Present at most one primary optional challenge per local academic day.
- Derive it from a ready document, an available quiz, a topic the student has studied, or a reviewable mistake.
- Examples: answer three questions from a studied topic; review one previous mistake; complete a short focus session and then answer one recall question.
- The challenge must be completable with the student's currently available materials and features.
- If no suitable source exists, show a useful empty state (for example, "Add a document to create a challenge") rather than inventing a task.
- Allow skip, snooze, and dismissal without penalty.
- Do not reset or punish unfinished challenges. Do not create an escalating backlog.
- Avoid repeating the same topic/action too frequently; use a simple recent-history exclusion window before any personalization model exists.

### 3.3 AZI Motivation Layer

AZI may:
- Acknowledge a verified completed action.
- State a measured change with baseline, sample size, and time window.
- Suggest one useful next action based on explicit evidence.
- Offer a break or a clear stopping point after a completed goal.
- Explain uncertainty when there is insufficient data.

AZI must not:
- Infer personality, intelligence, motivation, mental state, or reasons for inactivity.
- Claim a student is weak, lazy, behind, or at risk based on activity.
- Generate unsupported predictions about exam questions or professor behavior.
- Pretend to have monitored the student continuously.
- fabricate praise, streaks, achievements, or academic improvement.

## 4. Event model and evidence

Engagement calculations must consume canonical, user-scoped events from existing product workflows. They must not become a second source of truth.

Candidate event types:
- `focus_session_completed`: emitted only after a session is explicitly completed; include duration only for session reporting, not as reward weight.
- `quiz_attempt_completed`: emitted after the attempt is finalized.
- `answer_submitted`: associated with a completed attempt and question.
- `mistake_reviewed`: emitted only after an explicit review action.
- `study_pack_created`: may unlock a challenge but should not award mastery by itself.
- `topic_progress_updated`: derived, never manually fabricated.

Each event needs a stable event ID, user scope, event type, occurred-at timestamp, source entity ID, and minimal required metadata. Avoid copying full document text, question content, answer keys, or explanations into engagement events.

Use Qatar-local calendar boundaries by default where the account timezone is Asia/Qatar. Store timestamps unambiguously (UTC or offset-aware) and calculate day keys using the configured timezone. Reject malformed timestamps and future-dated or incomplete source records from completed-activity metrics.

Do not count the same source event twice. Prefer idempotent source IDs and deterministic derivations.

## 5. Progress and streak rules

### Streak definition
- A study day counts only when at least one qualifying learning action is completed.
- Qualifying actions for V1: a completed focus session, a completed quiz attempt, or an explicit mistake review.
- Merely opening AZ, opening a document, starting but abandoning a session, viewing a challenge, or receiving a notification does not count.
- Current streak is consecutive qualifying local calendar days ending today, or yesterday if today has not yet had a qualifying action.
- Longest streak is the maximum consecutive run in the available valid history.
- Missing days break the current streak naturally, but never remove historical achievements or earned progress.
- Do not describe a missed day as failure. Do not automatically send "streak at risk" messages.

### Topic progress
- Do not label a topic "needs review" until there are at least three valid submitted answers for that topic in the chosen window.
- Show accuracy together with the answer count and date window.
- Incomplete attempts, duplicate answer events, invalid question-topic mappings, and future-dated records are excluded.
- A low sample must be labelled "not enough practice data", not interpreted as low ability.
- Avoid claiming mastery from a single quiz or a small sample.

### Milestones
Initial milestone candidates:
- First completed study session.
- First completed quiz.
- First mistake reviewed.
- First three study days (not necessarily consecutive).
- First topic improvement, only when comparable samples and windows exist.

Milestones are awarded once, remain earned, and are not monetized. The criteria must be deterministic and testable.

## 6. Reward policy

If a lightweight points layer is introduced, award points only for distinct completed learning outcomes, with conservative caps:
- Completing a valid quiz attempt: small fixed reward.
- Explicitly reviewing a mistake: small fixed reward.
- Completing a focus session: reward for completion, not proportional to duration.
- Demonstrated topic improvement: milestone only after sufficient comparable evidence.

Do not award points for:
- Opening the app or returning daily.
- Keeping the app open or accumulating minutes.
- Repeatedly submitting the same attempt.
- Clicking through screens or notifications.
- Generating many low-quality questions.
- Creating a Study Pack without engaging with it.

Do not add streak multipliers, loss aversion, random loot, paid boosts, or pay-to-recover mechanics in V1. Points must never affect grades, academic standing, access to core study features, or the accuracy of AZI.

## 7. Daily challenge selection

Selection priority:
1. A due mistake explicitly marked for review by the student's prior activity.
2. A topic with enough evidence to justify another short practice set.
3. A recent Study Pack with available questions not yet attempted.
4. A short focus + recall action, only if the feature exists and can be completed.

Selection constraints:
- One active primary challenge per local day.
- No challenge without a valid source and a clear completion event.
- Respect dismissed/skipped challenges and avoid resurfacing them repeatedly.
- Do not select unavailable, deleted, processing, or unauthorized documents.
- Do not expose answer keys before the student submits an answer.
- A challenge completion is recorded only after the underlying action is completed.

## 8. UX and accessibility

- Keep Home centered on one clear "next step"; the challenge is a suggestion, not a competing dashboard.
- Show progress in context, close to the study action that produced it.
- Use calm, concise copy. Avoid red failure states for missed days.
- Provide a visible explanation ("Based on 4 completed answers this week") for data-derived insights.
- Offer controls to dismiss challenges and mute motivational prompts.
- Never block access to Planning, documents, quizzes, or results behind engagement actions.
- Support keyboard navigation, screen readers, sufficient contrast, Arabic pluralization, RTL layout, and reduced motion.
- Do not use animated streak flames, flashing badges, or persistent attention-grabbing overlays.

## 9. Privacy and security

- All event reads and derived progress must be scoped to the authenticated user.
- Do not expose another student's activity or progress by default.
- Do not introduce public leaderboards or social comparison in V1.
- Do not store raw document content or answer keys in engagement analytics.
- Keep answer keys and explanations behind the existing secure quiz backend boundary.
- Any future database schema or RLS changes require a separate reviewed migration proposal and explicit approval before applying to a live database.
- Provide a path to disable motivational messaging without disabling essential study functionality.

## 10. Success metrics

Primary product outcomes:
- Percentage of students who complete a meaningful learning action on multiple distinct days in a week.
- Quiz completion and mistake-review follow-through.
- Change in topic accuracy across comparable sample sizes and time windows.
- Completion of student-chosen study goals.
- Return behavior that remains stable without increasing notification volume.

Guardrail metrics:
- Challenge dismissal/disable rate.
- Notification opt-out rate.
- Student reports of pressure, guilt, or distraction.
- Repeated low-quality attempts or excessive challenge frequency.
- Performance and accessibility regressions.

Do not optimize for raw session duration, app opens, notification click-through, streak length alone, or daily active users without learning outcomes.

## 11. Rollout plan

### Phase A — Foundation (first implementation PR)
- Pure, deterministic progress derivation from existing user-scoped data.
- Unit tests for Qatar day boundaries, duplicate events, incomplete/future attempts, streak edge cases, and low sample sizes.
- No database writes, schema changes, UI gamification, or AI calls.

### Phase B — Study Pack integration
- Derive a daily challenge from the existing quiz workflow.
- Record challenge state only after an underlying qualifying action.
- Keep challenge optional and provide empty/skip/dismiss states.
- Keep answer-key security entirely in the quiz backend.

### Phase C — AZI Motivation Layer
- Generate short encouragement/next-step copy from verified structured evidence.
- Keep deterministic rules as the source of truth; AI may phrase, not invent, facts.
- Add tests that reject unsupported claims and ensure evidence is present.
- No always-on AI or background monitoring.

### Later, not V1
- Academic Skill Tree, richer visual universe, cooperative challenges, social progress, voice companion, and advanced personalization.
- Revisit only after the core Study Pack loop and evidence quality are proven.

## 12. Acceptance criteria for implementation

- Every displayed number can be traced to valid, user-scoped source data.
- Same input data always produces the same progress result.
- Duplicate events do not inflate progress.
- Incomplete and future-dated attempts do not count.
- Qatar-local day boundaries are tested.
- Low sample sizes never become ability labels.
- Skipping or disabling engagement features has no penalty.
- No points are awarded for time spent, app opens, or notifications.
- Challenge completion requires a verified underlying learning action.
- AZI cannot introduce unsupported scores, progress, diagnoses, or exam predictions.
- Arabic/English and RTL/LTR states are included in UI QA before shipping.
- No live database changes, API key activation, provider calls, or production deployment are included without separate approval.
