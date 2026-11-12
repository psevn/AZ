# AZ V1 — Retention, differentiation, and learning-value review

**Status:** Product review proposal for PSEVN; not an approved scope change  
**Prepared:** 2026-11-12  
**Scope:** V1 product strategy and sequencing only  
**No implementation, schema change, deployment, API activation, or pricing decision is authorized by this document.

## 1. Executive assessment

AZ has a credible direction, but it is not yet defensible merely because it can turn a student's PDF into summaries, flashcards, or quizzes. Those capabilities are already offered by established products including NotebookLM, Quizlet, RemNote, and StudyFetch.

AZ's stronger opportunity is to connect the full academic workflow around the student's own courses:

**Course context → materials → understanding → practice → verified mistakes → spaced review → planning → measurable progress → next useful action.**

The differentiator is the continuity and quality of this loop across a semester, not the number of AI tools or the amount of time a student spends in the app.

Do not promise that students will have no alternative or become unable to leave. Build a product they prefer because it reliably helps them learn and organize their academic work. Preserve export and user control; do not use lock-in as a retention strategy.

## 2. Current repository/product status observed

The repository's default branch is `main`. Its current README still describes an early foundation slice (authentication and an authenticated subject list), while much of the newer product work is in open draft pull requests.

Relevant existing work:
- [PR #39 — Healthy Learning Engagement specification](https://github.com/psevn/AZ/pull/39): progress, optional Daily Challenge, AZI encouragement, non-punitive engagement, evidence and privacy rules.
- [PR #41 — Daily Challenge selector](https://github.com/psevn/AZ/pull/41): deterministic selection from reviewable mistakes, available topics, and ready Study Packs.
- [PR #47 — Daily Challenge to Study Pack attempts](https://github.com/psevn/AZ/pull/47): connects a challenge to an existing quiz attempt.
- [PR #48 — Persist verified Daily Challenge completion](https://github.com/psevn/AZ/pull/48): durable completion receipt and server-side verification proposal.
- [PR #69 — Rule-based quiz analytics](https://github.com/psevn/AZ/pull/69): weak topics, accuracy, and streak calculations; its description says the functions are not yet wired to the UI.
- [PR #66 — AI cost and unit economics](https://github.com/psevn/AZ/pull/66): model routing, reuse, token reduction, cost budgets, and unit economics proposal.
- [PR #51 — Long-term Academic Universe vision](https://github.com/psevn/AZ/pull/51): long-term spaces, AI guides, simulations, and collaboration.

These are useful foundations, but open PRs are not merged product capabilities. Review their dependency chains and CI status before treating them as shipped. This review does not replace or authorize merging any of them.

## 3. Competitive reality: features that are not differentiators by themselves

A quick public-product snapshot (2026-11-12) shows substantial overlap:

| Product | Publicly documented capabilities overlapping AZ |
|---|---|
| Google NotebookLM | Source-grounded chat, citations, flashcards, quizzes, explanations, mind maps, audio/video overviews |
| Quizlet | AI study guides, flashcard generation, practice tests, homework help, spaced repetition |
| RemNote | PDF annotation, notes, AI tutor, generated flashcards/quizzes, guided PDF learning, spaced repetition and exam scheduling |
| StudyFetch | Notes, flashcards, quizzes, practice tests, study plans, tutoring, audio/video tools and spaced repetition |
| Anki | Mature flashcard scheduling, synchronization, media, customization and add-ons |

Sources:
- Google NotebookLM student features: https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/
- Google NotebookLM flashcards and quizzes: https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-app-quizzes-flashcards/
- Quizlet AI study tools: https://quizlet.com/features/ai-study-tools
- Quizlet practice tests: https://help.quizlet.com/hc/en-us/articles/25946589648013-Studying-with-Practice-Tests
- RemNote PDF Reader and Guided Learn Mode: https://help.remnote.com/en/articles/6690975-learning-from-pdfs-and-files-with-the-remnote-reader
- RemNote spaced repetition: https://help.remnote.com/en/articles/6022755-getting-started-with-spaced-repetition
- StudyFetch study tools: https://www.studyfetch.com/tools
- Anki: https://apps.ankiweb.net/

This is a feature-positioning snapshot based on public product documentation and marketing pages, not an independent benchmark of quality, price, availability in Qatar, or learning outcomes. StudyFetch's self-reported user and grade-improvement claims are not treated as independently verified evidence.

**Conclusion:** PDF upload, summarization, AI chat, flashcards, quizzes, citations, and even spaced repetition are table stakes or established capabilities. AZ must execute the connected workflow better for its target students.

## 4. Proposed AZ differentiation

### A. One connected academic record per course

Connect a student's subject/course, semester, exam dates, materials, Study Packs, practice attempts, mistakes, review schedule, and planning tasks. Avoid isolated AI tools that forget the academic context.

V1 version:
- Reuse the existing subject/course and Planning concepts.
- Let students associate a document or Study Pack with a subject.
- Preserve the link from each generated question/card to its source document and extracted page reference.
- Make clear when page references are extraction-derived and have not been independently verified against original PDF pagination.

### B. A closed learning loop, not a content generator

The minimum loop should be:
1. Upload and process a student's material.
2. Create a reusable Study Pack.
3. Learn from a concise summary or source-grounded explanation.
4. Practice with saved questions.
5. Review incorrect answers and explanations.
6. Update transparent topic-level evidence.
7. Schedule due review and suggest one next action.
8. Show the student what changed and why.

Generate content once where possible. Retakes, review, progress calculations, and planning should reuse stored content and deterministic code rather than trigger new model calls.

### C. Evidence-based personalization

Personalization should begin with transparent rules, not an expensive or opaque always-on agent:
- Use completed attempts and explicit review events.
- Display sample size and time window beside accuracy or topic status.
- Avoid ability, motivation, personality, or mental-state labels.
- Do not infer weakness from a tiny sample.
- Allow the student to correct topic mappings and dismiss recommendations.
- Let AZI explain a recommendation from structured evidence; AI may phrase it but must not invent the underlying facts.

### D. Planning that responds to real study progress

A differentiating AZ behavior is to connect practice outcomes to the student's plan:
- Offer to add a short review task when a topic is due or repeatedly missed.
- Show the reason, estimated duration, and source.
- Ask before inserting, moving, or deleting a student task.
- Avoid silently reshaping the student's schedule.

### E. Qatar-first and Arabic-first academic execution

Treat Arabic/English quality, RTL/LTR, Qatar-local academic dates, semester schedules, exam periods, and modest-device performance as product requirements, not translation polish. Validate with real university students in Qatar; do not assume local fit merely because the timezone is set to Asia/Qatar.

### F. Trust as a product capability

- Clearly distinguish source-grounded answers from general model knowledge.
- Show source document and extracted page references.
- Be transparent about extraction limitations and uncertainty.
- Never claim generated questions predict a professor's real exam.
- Keep each student's documents, attempts, and progress private and isolated.

### G. AZ Projects as a later network effect

Group projects can create durable semester-long value, but a full collaboration system adds permissions, ownership, synchronization, conflict handling, notifications, and support burden. Preserve the direction, but do not let full Projects collaboration delay the single-student learning loop. Ship only the already-approved minimal V1 surface or a clear Coming Soon state if that remains the current scope decision.

## 5. Recommended V1 scope: minimum useful differentiator

The following is a proposal to prioritize, not an automatic scope approval.

| Capability | V1 recommendation | Why |
|---|---|---|
| Subject/course context | Include a simple subject association for documents and Study Packs | Creates continuity across a semester |
| Reusable Study Pack | Include one reliable saved pack from student material | Turns upload into a reusable learning asset |
| Practice and mistake review | Include persisted attempts, explanations, and reviewable mistakes | Creates the core feedback loop |
| Topic analytics | Include transparent rule-based summaries with minimum sample sizes | Useful personalization without per-action AI cost |
| Spaced review | Include a small, deterministic due-review queue for saved cards/questions | Supports retention without a complex mastery engine |
| Next Best Action | Include one optional, explainable rule-based suggestion | Removes "what should I do now?" friction |
| Planning integration | Offer one-click, consent-based addition of a review task | Connects learning to execution |
| Focus Sessions | Keep task-linked focus and a clear stopping state | Supports focused work, not screen-time maximization |
| Weekly Review | Start with a deterministic summary of completed work, upcoming deadlines, due reviews and unresolved topics | High utility with little or no AI cost |
| AI model routing and cost logging | Include before public scale | Protects quality and unit economics |
| Full Knowledge Graph | Defer; store clean relationships now only where needed | Avoids premature graph infrastructure |
| Full AI proactive companion | Defer | Requires trust, evaluation, permissions, and cost controls |
| Full AZ Projects collaboration | Defer beyond core V1 unless separately approved | Significant engineering and security surface |
| Ads | Not part of beta/V1 by default; evaluate only after real revenue, focus, age and privacy analysis | Avoids monetizing an unproven attention channel |

### Minimum viable spaced review

Do not build a novel memory-science engine in V1. Start with a simple, tested scheduling policy using explicit recall ratings (for example: Again, Hard, Good, Easy), a due date, and a review history. Keep intervals configurable and validate retention with students. Avoid claiming scientifically optimal timing unless measured.

### Minimum viable Next Best Action

Use deterministic priority rules, for example:
1. A due mistake the student has not reviewed.
2. A review item that is due.
3. A topic with sufficient recent evidence of difficulty.
4. A student-chosen task or upcoming exam milestone.

Show one suggestion, its evidence, and a clear dismiss/accept action. Do not generate a fresh AI message on every Home render.

## 6. Healthy retention: what to optimize

The business objective is sustainable repeat value, not compulsive use.

Primary measures:
- Weekly meaningful learners: students completing a real learning action on multiple distinct days.
- Review follow-through: due reviews completed within a reasonable window.
- Learning retention: performance on later, comparable questions, not just immediate quiz score.
- Mistake recovery: percentage of reviewed mistakes later answered correctly on a new or suitably varied question.
- Student-chosen plan completion.
- 7-day and 30-day retention, interpreted alongside learning outcomes.

Guardrails:
- Do not optimize raw screen time, app opens, notifications clicked, streak length alone, or challenge completions without learning evidence.
- Make daily challenges optional and skippable.
- Never punish missed days or remove earned progress.
- No guilt, shame, fear-of-missing-out, public academic rankings, random rewards, or paid streak recovery.
- Provide a clear stopping point after the student's goal is completed.
- Let students control reminders and motivational prompts.

## 7. Cost and quality architecture

Extend the existing cost proposal with these engineering rules:
- Local-first: planning math, due dates, streaks, progress, and deterministic analytics run without model calls.
- AI-on-demand: invoke a model only when generated explanation or content adds meaningful value.
- Reuse-first: store and reuse summaries, questions, cards, and explanations when source/version and permissions match.
- Relevant-context-only: retrieve only the pages or chunks needed for the current task.
- Quality-gated routing: select the lowest-cost model that passes task-specific Arabic and English quality tests; escalate only when needed.
- Batch only non-urgent work; never make a student wait for a batch job in an interactive flow.
- Cost-aware features: log feature, model, input/output tokens, estimated/actual cost, latency, cache/reuse status, and outcome.
- Enforce per-user and global spend limits server-side; UI-only limits are not a cost control.
- Track cost per successful learning outcome, not only cost per API request.

Do not hard-code model prices in product logic. Treat the separate AI cost proposal and verified provider pricing as the source of truth.

## 8. What not to build in V1

- Full 3D campus, interactive city, or advanced spatial UI.
- A complex RPG economy, public leaderboards, collectible marketplace, or competitive rankings.
- Always-on/background AI monitoring or unsolicited autonomous schedule changes.
- A large knowledge graph or predictive mastery model before sufficient data exists.
- Voice/call infrastructure and multiple AI tutor personas.
- Full social feed, community network, or advanced project collaboration.
- Ads during Focus, Exam Mode, reading, quizzes, or Study Pack workflows.
- Any retention mechanic that relies on guilt, anxiety, loss aversion, or intentionally obstructed exit/export.

## 9. Validation plan before expanding scope

Run a small beta with students from different courses and compare:
- Baseline study workflow and time spent preparing materials.
- Completion of the upload → Study Pack → practice → mistake review loop.
- Delayed performance on comparable questions after 7 and 30 days.
- Whether students understand and trust source references.
- Whether Next Best Action is accepted, dismissed, or corrected.
- Weekly and 30-day return behavior.
- AI cost per active student and per successful learning outcome.
- Qualitative reports of distraction, pressure, and usefulness.

Use a small comparison or staged rollout where feasible. Do not claim causal learning improvement from self-selected users or simple before/after scores without acknowledging confounders. Collect only the minimum data needed and explain the evaluation to participants.

## 10. Research notes and limitations

Evidence supports retrieval practice and spaced practice as useful learning strategies, but the size and transfer of effects depend on context and implementation. Gamification evidence does not justify assuming that points, streaks, or leaderboards automatically create durable motivation.

Useful references:
- Li, Hew & Du (2024), meta-analysis and systematic review of gamification, autonomy, relatedness and competence: https://link.springer.com/article/10.1007/s11423-023-10337-7
- Guan et al. (2025), systematic review of educational chatbots and self-regulated learning: https://doi.org/10.1007/s10639-024-12881-y
- Google NotebookLM student learning features: https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/
- Quizlet practice tests: https://help.quizlet.com/hc/en-us/articles/25946589648013-Studying-with-Practice-Tests
- RemNote PDF learning: https://help.remnote.com/en/articles/6690975-learning-from-pdfs-and-files-with-the-remnote-reader
- StudyFetch tool suite: https://www.studyfetch.com/tools
- Anki product capabilities: https://apps.ankiweb.net/

This is a desk review, not a full hands-on usability benchmark or controlled competitor test. Public feature pages can overstate benefits and may vary by region, plan, or language. Recheck availability and pricing before making competitive claims.

## 11. Decisions explicitly left to PSEVN

1. Approve or reject the proposed V1 minimum differentiator table.
2. Decide whether spaced review is V1 or V1.1 after checking the current flashcard and quiz persistence work.
3. Decide the exact student-facing progress terminology and minimum evidence thresholds.
4. Decide whether AZ Projects remains Coming Soon in V1 or receives a separate minimal collaboration scope.
5. Approve no ads in beta/V1 unless new measured evidence changes the decision.

Until explicitly approved, this document is a review proposal only and must not be treated as authorization to expand V1, change database schema, merge stacked PRs, activate API keys, purchase services, deploy functions, or alter production.
