# AZ Engagement Strategy
> Product strategy for building healthy, sustainable academic engagement. This document defines product principles and implementation direction; it does not authorize manipulative engagement mechanics.

## 1. Product thesis

AZ should become a trusted part of a student's academic workflow because it consistently helps them make meaningful progress—not because it captures attention or creates anxiety.

**North star:** help students make better academic progress with less friction and less cognitive load.

Time in app, raw opens, notification clicks, and streak length are not success metrics on their own. A shorter session that helps a student complete a useful study task is a positive outcome.

## 2. Ethical engagement principles

1. **Value before frequency.** Every return should have a clear, useful academic reason.
2. **Learning before screen time.** Reward learning actions and progress, never passive time spent in AZ.
3. **Autonomy.** Students control goals, reminders, notification channels, quiet hours, and whether to use gamified features.
4. **No shame or loss aversion.** No streak resets framed as failure, guilt messages, punitive decay, or lost progress after absence.
5. **Recovery is part of the design.** Make it easy to resume after exams, illness, workload, holidays, or a deliberate break.
6. **Truthful feedback.** Report only observed activity and measured outcomes. Do not infer motivation, intelligence, personality, or emotional state from usage.
7. **Respectful defaults.** Notifications are sparse, actionable, contextual, and easy to disable. No dark patterns, random-reward loops, or artificial urgency.
8. **Student benefit is the test.** If a mechanic increases opens but does not improve learning, planning, or student experience, reconsider or remove it.

## 3. The AZ Academic Growth Loop

1. **Relevant cue:** Home or AZI surfaces one useful next step based on student-authorized context.
2. **Small action:** the student starts a manageable activity: a short review, a quiz, a focus session, or a planning action.
3. **Meaningful progress:** AZ records a real completed action or a measured learning result.
4. **Honest feedback:** show what changed, what was completed, and what remains uncertain.
5. **Reflection and choice:** offer a sensible next step; the student chooses whether to continue, reschedule, or stop.

The loop should end cleanly. AZ must not pressure students to continue after they have completed their intended work.

## 4. Product experience by surface

### Home — clarity in seconds
- Prioritize one context-aware **Next Step** card.
- Show a compact progress signal and a clear path to Planning and study materials.
- Collapse or defer secondary information; avoid a dashboard of competing cards.
- Explain why a suggested action is relevant and allow dismissal or snoozing.
- Do not manufacture a next step when there is insufficient data.

### Planning — control without guilt
- Make capture, editing, grouping, completion, and rescheduling fast and predictable.
- Connect tasks, subjects, deadlines, focus sessions, and study activities where the student opts in.
- Support realistic plans, flexible rescheduling, and recovery after missed tasks.
- Completing a task should provide restrained, accessible feedback; motion must be brief and respect reduced-motion settings.
- Never imply that a missed task is a personal failure.

### AZ Intelligence (AZI) — a useful academic companion
- Use only context the student has provided or explicitly connected and can inspect.
- Explain the basis for suggestions (for example: an upcoming exam, a selected goal, or recent quiz mistakes).
- Suggest; do not silently change schedules, send messages, or create tasks without consent.
- Prefer deterministic, low-cost rules for simple recommendations; use server-side AI only where it adds clear value.
- Distinguish observed facts from hypotheses and never claim to know a student's motivation or ability.

### Study Pack — the core learning value
- Build the loop from the student's materials: source document → grounded summary → retrieval practice → feedback → mistake review → later reassessment.
- Preserve page/source references where possible and communicate extraction uncertainty.
- Never imply that generated questions predict a professor's actual exam.
- Treat quiz accuracy as an observed result, not a complete measure of mastery.

### AZ Growth — optional recognition
- Consider XP, levels, milestones, and visual progression only after meaningful learning and activity events are reliable.
- Award recognition for useful actions (retrieval practice, reviewing mistakes, completing a self-chosen goal), not opening the app or accumulating screen time.
- Make rewards transparent, bounded, and optional. No random loot, paid power, public pressure, or progress loss.
- Keep academic mastery separate from gamified XP; do not let points masquerade as learning evidence.

## 5. Consistency and recovery

Use a humane consistency model:
- Measure active study days or completed study actions over a rolling period, with context shown clearly.
- Do not punish gaps or reset a student's level.
- Offer a low-friction restart, such as a five-minute review or a student-chosen next step.
- Weekly reflection should recognize progress, identify unfinished goals neutrally, and help the student adjust the coming week.
- Rest, breaks, and time away from AZ are legitimate outcomes.

## 6. Measurement framework

### Primary outcome
**Meaningful Academic Engagement (MAE):** the proportion of active students who complete at least one qualifying academic action in a defined period. Qualifying actions must be specified and versioned; examples include completing a planned focus session, completing retrieval practice, reviewing mistakes, or finishing a student-chosen academic task.

### Supporting measures
- D1 / D7 / D30 retention, interpreted alongside student outcomes.
- Weekly active study days and completed planned sessions.
- Retrieval-practice completion and mistake-review completion.
- Reassessment performance on comparable material, with sample size and limitations shown.
- Planning completion, rescheduling, and overdue-task recovery.
- Recovery rate after a period of inactivity.
- Student-reported usefulness, clarity, trust, and perceived pressure.
- Notification opt-out, mute, dismissal, and complaint rates.

### Guardrails
- Do not optimize session duration or notification click-through in isolation.
- Segment results carefully; do not infer sensitive traits.
- Avoid public leaderboards as a default.
- Do not claim learning improvement from engagement data alone.
- Establish a baseline before setting numeric targets.

## 7. Experiments and validation

Run small, reversible beta experiments before broad rollout (initial beta target: 15–50 students, subject to recruitment and consent).

For each experiment:
1. State the student problem and hypothesis.
2. Define the qualifying event and baseline.
3. Change one meaningful variable at a time where practical.
4. Measure academic value and guardrails, not just opens.
5. Collect brief voluntary student feedback.
6. Keep, revise, or remove the mechanic based on evidence.

Potential experiments:
- One Next Step card versus a denser Home.
- Student-configured reminders versus no reminders.
- Weekly reflection with a recovery action.
- Short retrieval-practice prompts linked to the student's own materials.

Do not interpret a small beta as proof of general effectiveness.

## 8. Delivery sequence

### V1 foundation
- Simplified Home with a useful Next Step.
- Reliable Planning capture, grouping, completion, and rescheduling.
- Focus sessions and activity events with clear definitions.
- Study Pack foundations: document ingestion, grounded summaries, quizzes, and mistake review as backend capability permits.
- Weekly Review.
- User-controlled, sparse reminders and quiet hours.
- Transparent usage/analytics boundaries and account/data controls.

### Later, after evidence
- Optional XP and levels.
- Growth milestones and visual progression.
- More proactive AZI suggestions with explicit consent.
- Carefully evaluated collaborative or social features.

### Explicit non-goals
- Maximizing screen time.
- Compulsive streak mechanics or punitive streak loss.
- Guilt, fear, artificial scarcity, or nagging notifications.
- Randomized rewards designed to create anticipation.
- Ranking students by public academic performance.
- AI claims about hidden motivation, personality, or intelligence.

## 9. Acceptance criteria

A feature that aims to increase engagement is not ready unless:
- Its student benefit and qualifying action are explicit.
- It can be dismissed, snoozed, disabled, or undone where appropriate.
- It does not punish absence or create artificial urgency.
- Its analytics are documented and privacy-conscious.
- It supports Arabic/English and RTL/LTR where user-facing.
- Motion respects reduced-motion preferences and does not block task completion.
- Its success measure includes academic value and at least one relevant guardrail.
- It does not claim an outcome the product has not measured.

## 10. Review cadence

Review this strategy weekly during active product development:
- What changed in Home, Planning, AZI, and Study Pack?
- Which acceptance criteria are satisfied, partially satisfied, or unverified?
- What evidence exists from tests, analytics, and student feedback?
- Are any mechanics increasing pressure or unnecessary time in app?
- What is the single highest-value next change?

Keep this document current as decisions evolve. Do not treat proposed mechanics as shipped functionality.
