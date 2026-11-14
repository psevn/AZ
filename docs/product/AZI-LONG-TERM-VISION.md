# AZ & AZI — Lifelong Learning Vision

**Status:** Strategic direction proposal for founder review  
**Last updated:** 2026-11-14  
**Scope:** Long-term product vision and architecture guardrails; not an authorization to expand the current MVP.

## 1. Vision

AZ aims to become a trusted learning and academic environment that can support learners across their educational journey: from early childhood learning (KG) and school through university, postgraduate study, and doctoral research.

The long-term ambition is:

**AZ — From first letters to the highest levels of knowledge.**

AZ is not exclusively a university application. Learners from different educational stages should be able to use AZ when the product offers an appropriate experience for their needs. The core product experience should be designed with particular attention to middle-school, secondary/high-school, and university/college learners, while the platform architecture and long-term product vision accommodate younger learners and advanced researchers too.

AZ remains one coherent product universe. Its experiences, teaching methods, content, safeguards, and workflows must adapt to the learner's educational stage. This is a long-term direction, not a claim that every stage is currently supported or will launch simultaneously.

AZI (the student's primary companion within AZ Intelligence) should be the consistent intelligence identity across these experiences. It should not behave identically at every age or academic level.

## 2. Learner segments and product priority

The product should be accessible to learners across these segments over time. Being outside the initial priority segments must not imply that a learner is unwelcome; it means that stage-specific capabilities and suitability must be validated before AZ claims to fully support that learner's needs.

| Segment | Product role | Illustrative learning needs |
|---|---|---|
| Early Learning / KG | Dedicated future experience | Letter recognition, phonics, early Arabic and English literacy, counting, colors, shapes, basic concepts, guided play |
| Primary School | Supported learner segment; age-appropriate capabilities required | Reading, writing, arithmetic, foundational science, language learning, foundational skills |
| Middle School | Core design priority | Subject understanding, concept connections, practice, homework support, study habits |
| Secondary / High School | Core design priority | Curriculum-aligned learning, exam preparation, practice, planning, transition guidance |
| University / College | Core design priority | Courses, lectures, academic materials, practice, projects, planning, research foundations |
| Postgraduate / Master's | Supported advanced segment | Advanced subject learning, research workflows, literature review support, analytical work |
| Doctoral / PhD | Supported advanced segment | Research organization, paper analysis, methodology support, evidence management, scholarly writing support |

Educational labels and age bands vary by country and institution. AZ should use configurable educational stages and curriculum context rather than hard-code one country's grade naming or assume that age alone determines a learner's level.

**Release-priority principle:** V1 is intentionally focused on three core learner stages: Middle School, Secondary / High School, and University / College. V2 is intended to expand the same AZ platform with dedicated Early Learning / KG and postgraduate / doctoral (Master's / PhD) experiences, subject to product, safety, quality, and readiness gates. Primary School remains part of the longer-term platform vision, but is not silently included in the V1 promise or automatically committed to V2.

## 3. One AZI core, adaptive educational experiences

Do not build a separate intelligence system for every educational stage. Build shared platform capabilities with explicit adaptation boundaries.

### Shared capabilities

- Secure identity, authorization, and user-controlled data.
- Context assembly and retrieval of relevant information.
- AI provider abstraction and model routing.
- Evidence-aware reasoning and uncertainty handling.
- Recommendation and task orchestration.
- Evaluation, quality monitoring, and cost accounting.
- Auditability and data lifecycle controls.

### Educational Adaptation Engine

A dedicated adaptation layer should select the appropriate educational behavior based on verified or user/guardian-provided context, including:

- Educational stage and, where appropriate, grade/year.
- Curriculum, country, institution, and subject.
- Language and literacy level.
- Learning objective and prerequisite skills.
- The task type and available evidence.
- Applicable age-related safety and permission policy.

Adaptation should control vocabulary, explanation depth, examples, pacing, question format, scaffolding, degree of learner independence, and the interaction mode. It must not rely on age or engagement signals alone to make unsupported judgments about ability.

### Experience profiles

The same AZI identity can support materially different experiences:

- **Early Learning:** short, bounded, visual and audio-supported activities; guided discovery; repetition and positive, non-manipulative feedback.
- **Primary School:** foundational skill-building, curriculum-aware explanations, guided practice, and caregiver-supported learning where appropriate.
- **Middle & Secondary School:** subject understanding, homework guidance, practice, exam preparation, study skills, and progressively increasing independence.
- **Higher Education:** course and material grounding, planning, practice, mistake analysis, project workflows, and academic integrity support.
- **Research Learning:** source-aware research organization, methodological reasoning support, literature workflows, and clear separation between assistance and the learner's scholarly responsibility.

These are experience profiles, not separate AI personalities or independent memory silos.

## 4. Early Learning / KG direction

Early Learning is a meaningful part of AZ's long-term vision. It requires a dedicated, age-appropriate experience and is not simply the university/school interface with a different prompt.

Potential future capabilities include:

- Arabic and English letter recognition and phonics.
- Vocabulary and word formation.
- Early reading and writing practice.
- Counting, number recognition, and basic arithmetic.
- Colors, shapes, patterns, animals, and everyday concepts.
- Short stories and age-appropriate comprehension activities.
- Guided, curriculum-aligned learning games.
- Voice-led activities and visual demonstrations when quality and safety are validated.

For example, AZI could introduce the letter A, associate it with an apple, demonstrate its sound, invite the child to identify the letter, and then offer a short reinforcement activity. The goal is skill acquisition and understanding, not maximizing screen time or AI conversation length.

### Early Learning interaction constraints

- Prefer bounded lessons and learning activities over unrestricted open-ended chat.
- Keep sessions short and age-appropriate, with natural stopping points.
- Encourage offline play, caregiver interaction, reading, movement, and real-world activities.
- Avoid manipulative streaks, pressure, shame, addictive reward loops, or engagement-maximizing design.
- Do not present AZI as a human, a replacement parent, or a substitute teacher.
- Provide caregiver-visible controls and understandable progress summaries.
- Do not ask children for unnecessary personal information or encourage disclosure of sensitive information.

Voice, conversational companionship, and advanced multimodal capabilities are future options, not prerequisites for an initial Early Learning release.

## 5. Child safety, privacy, and account lifecycle

Supporting children changes the product's safety and compliance obligations. These requirements must be designed before any child-facing launch, not retrofitted after it.

The future design must include:

1. **Guardian relationship:** age-appropriate account creation, guardian association, and consent flows where required by applicable law.
2. **Least privilege:** children see only the features and data necessary for their learning activities.
3. **Bounded AI behavior:** age-appropriate response policies, content restrictions, escalation behavior, and protections against harmful or manipulative interactions.
4. **Data minimization:** collect only what is necessary; define retention periods and deletion behavior for child data.
5. **Guardian controls:** accessible controls for permissions, activity visibility, settings, and data requests, consistent with the child's rights and applicable law.
6. **Clear identity:** AZI must be transparent that it is an AI system and must not encourage emotional dependency or secrecy from caregivers.
7. **Security and isolation:** enforce server-side authorization and tenant isolation; never rely on frontend-only restrictions.
8. **Audit and accountability:** record important permission changes and consequential actions without retaining unnecessary sensitive content.
9. **Transition to independent use:** define how accounts, guardian access, consent, and historical data are reviewed when a learner reaches the relevant age or legal threshold. Do not assume guardian access continues indefinitely.
10. **Jurisdiction review:** assess applicable child privacy, education, consumer protection, and AI requirements in every launch market. No single global age or consent rule should be hard-coded as universally applicable.

A child's learning history must not automatically become an unrestricted lifelong profile. Any continuity into later educational stages must be purpose-limited, reviewable, correctable, and governed by appropriate consent and retention rules.

## 6. Academic evidence and memory across stages

AZI's memory should be structured, evidence-aware, and scoped to the learner's needs—not an indiscriminate transcript archive.

For meaningful learning observations, distinguish:

- **Observed facts:** directly recorded results or learner-provided information.
- **Hypotheses:** possible explanations that require further evidence.
- **Confirmed understanding:** supported by appropriate follow-up assessment.
- **Outdated context:** information that may no longer describe the learner.
- **Learner/guardian-confirmed context:** information explicitly reviewed by an authorized person.

Where appropriate, retain provenance, timestamp, context, confidence, and correction status. A single wrong answer or short period of inactivity must not be treated as proof of a knowledge deficit, motivation, personality, or ability.

Memory should be partitioned by purpose and educational context. Transitions between stages should trigger review and minimization rather than silently carrying every historical record forward.

## 7. Technical architecture implications

The long-term architecture should preserve a shared core while allowing stage-specific experiences and policies.

Recommended logical modules:

- **Identity & Access:** learner accounts, guardian relationships, roles, consent, and authorization.
- **Learner Context:** educational stage, curriculum, language, goals, and user-confirmed preferences.
- **Academic Memory:** structured learning evidence, provenance, retrieval, correction, retention, and deletion.
- **Educational Adaptation:** stage- and task-specific teaching policies, scaffolding, and content constraints.
- **Intelligence & Evaluation:** reasoning, explanations, recommendations, model routing, quality evaluation, and cost controls.
- **Agent & Action Orchestration:** bounded workflows and permission-checked actions.
- **Learning Activity & Assessment:** lessons, practice, attempts, feedback, and measurable outcomes.
- **Interaction Adapters:** text first; voice and visual explanation later; shared interactive workspace in a later phase.
- **Safety, Privacy & Audit:** policy enforcement, data lifecycle, monitoring, and accountable action records.

For the current team and product stage, prefer a modular monolith with clear internal interfaces over premature microservices. Keep the interaction layer separate from the intelligence and memory contracts so future voice and workspace experiences can reuse the same authorized capabilities.

Do not introduce a separate always-on AI process for proactive behavior. Use deterministic scheduling, events, and backend workflows where possible; invoke AI only when semantic understanding or generation is actually needed.

## 8. Phased delivery strategy

The release strategy is explicit: **V1 serves Middle School, Secondary / High School, and University / College as its three core learner stages. V2 is the planned expansion path for dedicated KG / Early Learning and postgraduate / doctoral (Master's / PhD) experiences.** This is a product-scope direction, not a claim that all listed capabilities are already implemented or a guarantee that every expansion ships simultaneously.

### V1 — Three core learner stages: Middle School, Secondary / High School, and University / College

V1 must be designed and validated for all three core stages—not university-only and not university-first by default. The shared product foundation should support each stage through appropriate learner context, explanations, practice, planning, and safeguards. V1 scope does not mean that every feature behaves identically across the three stages; stage-appropriate adaptation is required. Learners outside these three stages must not be promised a dedicated experience until it is built and validated.

Initial delivery priorities should be selected from the approved AZ product scope and validated user needs. They may include:

- Secure learner context and age/stage-appropriate onboarding.
- Subject and course context, with curriculum information where available.
- Structured academic evidence and memory foundations.
- Context assembly rather than sending full history on every request.
- Grounded explanations and practice workflows.
- Transparent mistake analysis and progress measurement.
- Evidence-based recommendations.
- Permission-aware Planning and other AZ actions.
- Cost tracking, quality evaluation, privacy, and deletion controls.

### V1 AZI capability baseline — the student's academic companion

AZI in V1 should be more than a question-answering chat. It should provide a useful, context-aware academic companion through conversation, structured memory, evidence-based observations, recommendations, and permission-checked actions. The same capability foundation serves Middle School, Secondary / High School, and University / College, while the Educational Adaptation Engine adjusts language, explanation depth, scaffolding, autonomy, and safeguards for each stage.

#### A. Student interaction: text and contextual notes (V1)

- Provide a persistent text conversation entry point for academic questions and help with the learner's AZ context.
- V1 is text-first. Voice input, spoken responses, read-aloud, and real-time voice conversation are explicitly out of V1 scope.
- Voice may be considered for V1.5 as a separately scoped enhancement, only after validating actual provider/device costs, browser and device support, Arabic and English quality, privacy, accessibility, and expected student usage. Prefer low-cost or on-device options only when they meet quality and privacy requirements; do not assume speech is free.
- Allow AZI to deliver concise, contextual notes and observations in the product, not only replies inside chat. Examples include an upcoming deadline, a repeated practice error, or a useful next step.
- Recommendations and proactive notes must be relevant, explainable, appropriately timed, dismissible, and controllable by the learner. Avoid noisy notifications, pressure, shame, manipulative streaks, or engagement-maximizing behavior.

#### B. Structured academic memory

AZI should maintain a purpose-limited, searchable academic context rather than treating the entire conversation transcript as permanent memory. Relevant context may include:

- Learner-confirmed educational stage, grade/year, subjects/courses, curriculum context, language, goals, and preferences.
- Learner's schedule, deadlines, study sessions, and relevant task state.
- Uploaded learning materials and source references, subject to access and retention rules.
- Practice attempts, outcomes, recurring error patterns, completed reviews, and progress evidence.
- Explicitly confirmed plans and decisions that remain useful over time.

For each meaningful memory item, preserve appropriate provenance, timestamp, scope, and status. Distinguish observed facts, learner-confirmed facts, hypotheses, and outdated context. Do not infer intelligence, motivation, personality, or ability from sparse activity or isolated mistakes. Learners must be able to inspect, correct, and delete relevant stored context; retention and deletion must follow the platform's data lifecycle rules.

#### C. Evidence-based weakness detection and recommendations

- Detect topics that may need attention from repeated, sufficiently relevant assessment evidence—not from a single wrong answer alone.
- Show the evidence behind an observation (for example, recent attempts or repeated errors) and communicate uncertainty honestly.
- Recommend a next step such as reviewing a source section, generating targeted practice, revisiting mistakes, or scheduling a short study session.
- Recognize improvement as well as difficulty. Do not label a learner as weak or incapable.
- Prefer deterministic aggregation and transparent rules for counts, trends, deadlines, and scheduling; use an AI model only when interpretation or natural-language generation adds real value.

#### D. Planning assistance and permission-checked actions

AZI should understand relevant Planning context and be able to propose useful changes, including:

- Suggesting an available time for a study session based on existing commitments and learner preferences.
- Proposing a new session, task, deadline adjustment, or study-plan change when supported by the user's request and context.
- Explaining the reason for a proposed change and showing its impact on existing commitments.
- Creating or changing schedule items only after the learner explicitly confirms the specific action. Never silently rewrite a learner's schedule.
- Respecting permissions, ownership, time zone, conflict checks, and action audit requirements.

#### E. AZ Projects — support for project leaders and members

Within the shared project context, AZI may help a leader and team by:

- Summarizing shared task status, completed work, overdue items, and upcoming project deadlines.
- Highlighting project-level blockers or missing updates based only on information visible to the project.
- Helping the leader draft task assignments, reminders, and weekly progress summaries.
- Giving each member relevant personal reminders and suggestions about their own assigned tasks.
- Suggesting a Planning focus session for a member, with that member's approval before creating it.

Project leadership does not grant access to private AZI conversations, personal academic memory, private schedules, or unrelated learner activity. Leaders see only project data and progress explicitly shared through project permissions. AZI must not expose private member data in leader summaries.

#### F. Low-cost implementation architecture

Use a tiered execution model to keep AZI useful without making every interaction an AI API call:

1. **Deterministic application logic first:** calculate deadlines, schedule conflicts, task status, practice counts, trends, and eligible time slots using application data and tested rules.
2. **AI only when semantic work is needed:** use the configured provider for understanding open-ended requests, grounded explanations, synthesis, and natural-language recommendations when deterministic logic is insufficient.
3. **Small, relevant context:** retrieve only the learner/project information needed for the current task; do not send the full academic history or entire conversation on every request.
4. **Reuse and control:** reuse safe derived results where appropriate, avoid duplicate generation, apply model routing and token/output limits, and record cost by feature and user plan.
5. **No always-on agent:** trigger proactive checks from scheduled jobs, application events, or deterministic thresholds; invoke a model only if the event requires interpretation or generated language.
6. **Provider abstraction:** keep model capabilities behind replaceable interfaces. Speech integration may be added behind a separate replaceable adapter in V1.5 or later; do not build or pay for speech infrastructure as a V1 dependency.

These principles are architectural requirements, not a promise that every feature has zero cost. Any paid model or speech usage must be measured, budgeted, rate-limited, and governed by the product's subscription and usage limits.

#### V1 acceptance checks for AZI

Before calling the V1 AZI experience ready, verify that:

- The same core companion workflows work for representative Middle School, Secondary / High School, and University / College scenarios, with stage-appropriate language and scaffolding.
- Text conversation can use only authorized, relevant learner context and grounded AZ materials where applicable.
- Memory items have provenance/status and can be corrected or deleted through supported user controls.
- Weak-topic observations can be traced to actual attempts and avoid unsupported conclusions from isolated events.
- Recommendations explain their evidence and can be dismissed or acted on.
- A proposed Planning change is previewed and requires explicit confirmation; conflicts and time-zone behavior are tested.
- Project summaries respect project membership and role permissions and never disclose private AZI conversations or personal academic memory.
- Deterministic flows work without an AI call where possible, while AI usage, failures, and cost are observable and bounded.
- V1 acceptance does not depend on voice features. Any V1.5 voice proposal must first pass device/browser, Arabic and English quality, accessibility, privacy, cost-per-use, and usage-budget checks; full-duplex real-time voice requires a separate approval.

The initial release must not be blocked by building every stage-specific experience at once. However, foundational choices—such as educational-stage representation, language support, adaptation boundaries, and permission architecture—should avoid hard-coding university-only assumptions.

### V2 planned expansion — Early Learning / KG and Postgraduate / Master's / PhD

V2 is the intended expansion phase for two distinct areas:

- **Early Learning / KG:** a dedicated experience for foundational literacy, phonics, counting, concepts, guided activities, caregiver controls, child safety, and age-appropriate evaluation.
- **Postgraduate / Master's / PhD:** advanced academic and research workflows, source-aware literature work, methodology support, evidence management, and scholarly writing support with academic-integrity safeguards.

These are planned V2 directions, not existing V1 capabilities. Each requires its own validation and release-readiness gates. KG must not be treated as the school/university interface with a simpler prompt, and doctoral research must not be treated as ordinary homework support.

### Longer-term expansion — Primary School and further research capabilities

Primary School remains within AZ's long-term learning-universe vision. Its timing and release placement are not fixed by this proposal. Develop a dedicated experience only when appropriate educational content, interaction design, safeguarding, caregiver controls, and age-appropriate evaluation are ready. Do not assume that a general chat interface can be adapted simply by changing its prompt.

### Future research and advanced learning capabilities

Add research-specific workflows and source-handling requirements while preserving academic integrity, attribution, and the learner's responsibility for scholarly claims.

The order and timing of expansions beyond the initial core focus remain founder decisions and require validation. This document does not approve a launch date, budget, subscription change, or implementation scope for any future segment.

## 9. Success measures by segment

Measure educational usefulness and safety, not screen time.

| Segment | Example outcome measures |
|---|---|
| Early Learning / KG | Skill acquisition on age-appropriate assessments, retention of foundational skills, caregiver trust, safe-session rates |
| Primary School | Foundational skill improvement, concept understanding, appropriate caregiver/teacher feedback, safe and useful sessions |
| Middle School | Concept understanding, practice improvement, task completion, learner confidence, teacher/caregiver feedback |
| Secondary School | Curriculum alignment, demonstrated understanding, practice quality, planning usefulness, exam-preparation confidence |
| University | Material-grounded answer quality, mistake-review follow-through, useful study actions, retention, cost per useful outcome |
| Postgraduate / PhD | Source traceability, research workflow usefulness, analytical quality, correction rates, academic-integrity compliance |

Every segment needs representative evaluation datasets, human review where appropriate, accessibility testing, and privacy/safety acceptance criteria before release.

## 10. Explicit non-goals and guardrails

This vision does **not** mean:

- KG / Early Learning and postgraduate / PhD experiences are part of the V1 launch promise; they are planned V2 expansion directions instead.
- AZ is exclusively for university students.
- All learners receive the same interface or unrestricted capabilities regardless of age.
- One generic prompt is sufficient for every age and discipline.
- AZI should replace parents, teachers, universities, or independent learning.
- More engagement or longer screen time means better learning.
- A child's entire history should be retained indefinitely.
- AI-generated explanations or research outputs are automatically correct.
- The architecture must become microservices or use expensive always-on models.
- Any future capability, budget, provider, subscription, or release date is approved by this document.

## 11. Decisions still requiring founder review

- Which curricula, countries, and learner segments should be validated first.
- The exact V1 feature scope and acceptance criteria for each of the three core stages: middle school, secondary/high school, and university/college.
- The V2 readiness gates, sequencing, and exact feature scope for KG / Early Learning and postgraduate / PhD.
- Whether Early Learning should appear as a dedicated AZ experience (for example, an AZ Kids area) or as a separately branded experience within the AZ ecosystem.
- Guardian account and consent model, subject to legal review.
- Initial languages and curriculum content for KG and primary school.
- Human educational-content review and quality assurance process.
- Commercial model and affordability for family/guardian accounts.
- Evidence and readiness gates for each expansion.

---

**Guiding principle:** One trusted AZ learning universe, one coherent AZI intelligence foundation, and educational experiences that adapt responsibly to each stage of a learner's journey.
