# AZI V1 — Low-Cost Intelligence Foundation

**Status:** Proposed implementation foundation; no production capability is implied by this document.
**Target:** AZ V1
**Cost principle:** Build useful academic intelligence from AZ's own authorized data and deterministic code first. Add paid model calls only when they provide a clear capability that rules cannot provide.
**Voice:** Explicitly deferred. No live audio, speech-to-text, text-to-speech, phone calls, or always-on microphone in this phase.

## 1. Product boundary

- **AZ** is the platform.
- **AZ Intelligence** is the intelligence system and product section.
- **AZI** is the student's primary companion and interface to AZ Intelligence.
- AZI is not a generic chat wrapper and must not claim capabilities that are not implemented.
- AZI may eventually work across Home, Planning, AZ Intelligence, AZ Projects, and Profile. The current implementation must navigate only to routes/screens that actually exist and that the signed-in student is authorized to access.
- Navigation is not permission to edit, delete, submit, invite, or share data.
- Consequential changes must be proposed first and require explicit confirmation unless a future narrowly scoped permission is deliberately enabled by the student.

## 2. Cost strategy

### Phase A — zero model-API usage

Implement the foundation without calling a paid AI model:

1. Resolve the signed-in student's current screen and minimum relevant context.
2. Read only the student's existing AZ records through the authenticated Supabase client and existing RLS policies.
3. Calculate transparent metrics and patterns using deterministic TypeScript functions.
4. Convert those findings into evidence-backed insight cards and simple, pre-authored explanations.
5. Let AZI navigate to an existing screen or prepare a proposed next step; do not silently mutate data.
6. Test with synthetic fixtures and unit tests.

This phase should make no model-provider requests and should not require a paid AI subscription, API key, embeddings, vector database, or background worker.

### Phase B — optional, budget-limited text reasoning

Only after Phase A is useful and verified, evaluate one server-side text-model integration. Provider selection is a separate owner decision; do not assume OpenAI, Gemini, or another provider.

When enabled:

- Call the model only for tasks that genuinely need language understanding or reasoning beyond deterministic code.
- Use a server-side endpoint; never put provider secrets in `VITE_*` variables or browser bundles.
- Send the minimum necessary context, not a full student history by default.
- Set per-user and global usage limits, request-size limits, rate limits, and a hard monthly budget.
- Record provider, model, task type, token usage, estimated cost, latency, and outcome without logging unnecessary student content.
- Use deterministic fallbacks when the provider is unavailable or the user's allowance is exhausted.
- Cache safe, reusable results where appropriate; do not reuse one student's private result for another student.
- Do not enable paid calls until the owner explicitly approves the provider and budget.

## 3. Initial data sources and honest availability

The inspected `feature/planning-todolist-redesign` branch currently has visible foundations for:

- `subjects`: subject identity and available academic metadata.
- `tasks`: due dates, priority, estimated duration, status, and completion timestamp where the column exists.
- `focus_sessions`: recorded focus activity.
- `documents`: document metadata and ready-state access in the workspace flow.
- `academic_terms`, `class_meetings`, and `academic_setup`: academic setup and timetable context.

Important limitations:

- Do not infer quiz mastery, repeated misconceptions, or question-level learning gaps until a verified quiz-attempt and review data flow exists. The current Planning PR explicitly records that the end-to-end quiz-generation/attempt/review flow is not yet present.
- Do not assume AZ Projects membership, shared-document, or task data is available to AZI until its schema and authorization model are inspected.
- Missing data means “not enough evidence,” not zero performance or poor performance.
- Confirm the exact deployed schema and RLS policies before relying on any field; a branch migration is not proof that the migration was applied to the live Supabase project.

## 4. Architecture boundaries

Keep the first implementation small, modular, and provider-independent:

- `context/`: current section, current screen, selected subject/task/document identifiers, and locale. Only pass identifiers and the minimum display context needed.
- `data/`: authenticated, read-only loaders for the signed-in student's permitted records. Reuse the existing Supabase client and RLS; never use a service-role key in the browser.
- `analytics/`: pure deterministic functions for task load, overdue work, completion trends, focus totals, and available subject-level summaries.
- `insights/`: rules that turn measured facts into a small number of useful, explainable insights with evidence and timestamps.
- `actions/`: typed navigation intents and proposed in-app actions. Navigation may execute when the destination exists and intent is clear; data-changing actions require confirmation and server/database authorization.
- `ai-provider/`: a provider-neutral interface reserved for Phase B. Phase A must not instantiate a provider or make network calls to an AI model.

Prefer pure functions for calculations so they can be tested without Supabase, network access, or paid services.

## 5. Student profile / memory approach

Do not create a costly or complex “AI memory” system in the first pass.

- Derive a temporary academic context from the student's authorized AZ records when needed.
- Separate measured facts (for example, completed tasks) from interpretations (for example, a possible workload issue).
- Include evidence and the time window behind each insight.
- Do not store speculative personality traits, sensitive inferences, or unverified learning diagnoses.
- Do not retain a separate long-term memory table until a concrete use case, retention policy, correction/deletion behavior, and owner-approved schema are defined.
- Respect account deletion and the student's ability to disable personalization.

## 6. Proactive behavior without background cost

The first version is event-driven, not always-on:

- Recalculate insights when the student opens AZI or an explicitly relevant screen, or after a relevant action already performed in AZ.
- Do not poll continuously, run scheduled AI analysis, or create background model calls.
- Show at most a small number of high-value insights; avoid repeated prompts and interruptions.
- Make the reason for each suggestion visible and dismissible.
- If the data is stale or incomplete, say so.

## 7. Security and trust requirements

- Every data query must remain scoped to the authenticated user and rely on verified RLS.
- Never let a client-supplied user ID authorize access to another user's records.
- Do not fetch project content unless the user is an authorized project member and the backend enforces that membership.
- Keep model/API secrets server-side if Phase B is approved.
- Treat model output as untrusted text, not executable instructions or authorization.
- Validate every proposed action against current permissions at execution time.
- Keep an audit trail for consequential actions and their confirmation, without collecting unnecessary conversation content.
- Never claim to predict a professor's actual exam.
- Be explicit about uncertainty and distinguish facts from hypotheses.

## 8. Explicitly out of scope for this foundation

- Voice calls, live audio, microphone access, speech recognition, and speech synthesis.
- Always-on listening, continuous monitoring, and background AI agents.
- Fine-tuning or training a custom model.
- Embeddings, vector search, and a dedicated vector database.
- Multi-agent orchestration.
- Automatic edits, submissions, deletions, sharing, or project invitations.
- New database migrations or paid provider activation without separate review and owner approval.

## 9. Implementation sequence and acceptance checks

### Step 1 — architecture and data audit
- Verify the actual app routes/state, current schema, migrations, and RLS.
- List which records AZI can safely read today and which are unavailable.
- Do not change the UI, live database, or existing Planning work.

### Step 2 — deterministic intelligence core
- Add pure TypeScript context and analytics modules.
- Add fixtures for empty, sparse, normal, and large student histories.
- Test timezone/date boundaries and incomplete data.
- Verify that identical inputs produce identical outputs.

### Step 3 — insight and navigation contracts
- Add typed insight and navigation-intent contracts.
- Ensure every insight includes evidence, time window, and confidence/limitations.
- Ensure unavailable destinations are never offered as working navigation.

### Step 4 — controlled AZI entry point
- Only after the owner approves the UI integration point, add a minimal AZI entry point without redesigning the approved shell or changing the five primary destinations.
- Text-only interaction; voice remains deferred.

### Step 5 — optional model evaluation
- Compare providers and real task quality only when there is a concrete need.
- Estimate per-student costs with test usage before enabling paid calls.
- Require explicit approval for provider, limits, and budget.

### Acceptance criteria for Phase A

- No paid AI-model requests are made.
- No new database migration is applied.
- No service-role key or secret is exposed to the browser.
- No data from another user can appear in the context or insights.
- No insight claims data that does not exist.
- Each insight is traceable to evidence and can explain its limitation.
- Navigation cannot bypass access control.
- No data-changing action runs without the required confirmation.
- Tests cover empty data, incomplete records, date/time boundaries, and cross-user isolation assumptions.

## 10. Repository workflow

- Start from the current Planning work branch only as a separate child branch; do not modify or merge the open Planning draft PR.
- Keep AZI implementation isolated in `feature/azi-intelligence-core`; retain `feature/azi-low-cost-foundation` as the original documentation-only foundation branch.
- No changes to `main`, no PR merge, no database execution, no deployment, and no paid-service activation without explicit owner approval.

## 11. Unified Academic Intelligence — product architecture decision

**Decision:** AZI is designed from the beginning as one unified intelligence system for both individual students and collaborative teams. Team Intelligence is not a bolt-on assistant for project leaders, and AZI must not be architected as a personal-only assistant that is later retrofitted for collaboration.

The unified system has four connected dimensions:

### 11.1 Personal Intelligence

Understand each student's academic context using only data that is available, relevant, authorized, and permitted by that student. Depending on verified product data, this may include:

- The student's goals, subjects, deadlines, tasks, focus activity, and academic timetable.
- The student's own responsibilities within each AZ Project.
- Their progress on assigned project work and dependencies that affect their tasks.
- Explicitly provided preferences, such as preferring shorter work sessions, only where the preference is available and the student has agreed to its use.

Do not infer motivation, personality, laziness, or intent from task status. An incomplete task is evidence only that the task is not recorded as complete; it is not evidence that the student did no work.

### 11.2 Team Intelligence

Understand the collaborative project as a shared work system, while preserving each member's individual privacy.

- Understand project membership, each member's assigned responsibilities, task status, deadlines, dependencies, and project-level progress only where the AZ Projects schema and authorization rules explicitly permit access.
- Communicate with every member individually in the context of their own role and assigned work; AZI is not limited to the group leader.
- Give a member useful, personal guidance about their own responsibilities and next steps.
- Give the project leader a factual project-level overview: recorded progress, incomplete or overdue project tasks, dependency blockers, and risks to the delivery date.
- Never expose a member's private Planning, personal timetable, exams, private notes, or unrelated academic circumstances to the project leader or other members.
- Never label a member as lazy, inactive, or uncooperative based only on an incomplete task or missing activity record. Describe the observable project fact and its limits.

AZI must use the same project membership, role, and row-level authorization boundaries as the product itself. AZI does not receive privileged access merely because it is an assistant. Do not assume project data or access is available until the actual schema, backend enforcement, and RLS have been audited.

### 11.3 Academic Intelligence

Connect the student's academic workload and AZ Projects responsibilities to identify useful relationships, opportunities, and conflicts, for example:

- A project deadline approaching while assigned work remains incomplete.
- A proposed work session conflicting with a class, exam, or another commitment visible to that student.
- A project task whose delay affects dependent tasks or the team's delivery risk.
- A more suitable time to work when the student's own schedule indicates an upcoming exam or a heavy academic period.

Cross-domain reasoning must use only the minimum authorized data needed. A team-level recommendation may take account of a student's availability only through a privacy-preserving result or consented signal; it must not reveal the underlying private schedule to teammates.

### 11.4 Action Intelligence

Turn insights into useful, controlled next steps:

- Explain what AZI observed and the evidence behind its suggestion.
- Offer to discuss a task, break it into steps, or prepare a proposed Planning item or focus session.
- Suggest a suitable time using the student's own available schedule, when that schedule is available and authorized.
- Show the proposed task/time and obtain the student's explicit confirmation before adding or changing anything in personal Planning.
- Recheck authorization and relevant state when the action is executed. A suggestion or navigation intent never grants permission to mutate data.
- Keep consequential actions attributable and auditable.

## 12. Proactive team-member experience and notification principles

AZI should not wait for a student to ask when a timely, evidence-backed intervention would genuinely help. This is controlled initiative, not continuous surveillance or interruption.

A suitable future example:

> A project delivery date is approaching. AZI notices that a task assigned to this member is not yet recorded as started or completed. It explains the remaining time and asks whether the student wants to plan a work session. If the student agrees, AZI considers the student's permitted availability, proposes a time, and asks for confirmation before adding it to personal Planning.

This is a product scenario, not a claim that the feature currently exists.

Requirements:

- Personalize the message to the member's role, assigned work, verified progress, deadline, dependencies, and permitted academic context. Do not send the same generic message to every member.
- Use personal timetable and exam information only for that student's own recommendation. Do not reveal those details to the team.
- Use prior work-pattern preferences only when there is sufficient reliable data and the student has consented to that personalization. Otherwise, do not guess.
- Make notifications useful, limited, non-duplicative, and dismissible. The student controls notification preferences and timing.
- Prefer in-app notifications in the initial product. External channels require separate design and permission.
- Do not continuously poll or run always-on AI. The low-cost foundation remains event-driven; proactive delivery can be introduced later through carefully scoped events and schedules after reliability, cost, and consent controls are designed.
- If the data is missing, stale, or ambiguous, say so and avoid pressure or unsupported claims.
- Never add, reschedule, or otherwise modify personal Planning without explicit student confirmation.

## 13. Unified architecture and staged delivery

The four dimensions share common foundations rather than becoming separate assistants:

- **Identity and permissions:** authenticated student identity, project membership, roles, RLS, and action-time authorization.
- **Context:** current screen and relevant personal or project context, selected by purpose and permission.
- **Data access:** separate, narrowly scoped personal-data and project-data readers. Team readers must enforce project membership and role boundaries on the backend.
- **Analytics:** deterministic calculations for personal workload, focus, project progress, deadlines, and task dependencies where verified data exists.
- **Insights:** evidence-backed explanations that distinguish observed facts from hypotheses and include freshness/limitations.
- **Action contracts:** typed navigation and proposed actions, with confirmation for personal Planning changes and other consequential operations.
- **Delivery:** controlled in-app notifications with student preferences, deduplication, and frequency limits.
- **Optional language reasoning:** a provider-neutral, server-side model interface only in the separately approved, budget-limited phase. Model output never grants access or authorization.

Suggested staged implementation:

1. **Personal foundation:** complete deterministic analytics and evidence-backed insights using verified personal data; no paid model calls.
2. **Shared contracts:** define common identity, context, insight, action, and notification contracts so personal and team intelligence fit one system.
3. **AZ Projects audit and integration:** inspect the actual project schema, membership/role model, task dependencies, backend enforcement, RLS, and deployment status before reading or acting on team data. Do not merge a separate Projects branch or apply migrations as part of this step without explicit approval.
4. **Team Intelligence:** add member-specific and leader-level project insights, each restricted to its permitted project scope.
5. **Academic Intelligence:** connect permitted personal academic context to project planning without disclosing private schedule details.
6. **Action Intelligence:** add proposed Planning sessions and task actions with explicit confirmation, reauthorization, and auditability.
7. **Controlled proactive delivery:** introduce event-driven in-app notifications with user controls, deduplication, and frequency limits.
8. **Optional text reasoning and voice:** only after a demonstrated need and separate approval. Voice remains deferred; no always-on microphone.

The stages are an implementation sequence, not separate product identities. The architecture and data contracts should support all four dimensions from the start, while each capability is released only when its data, security, UX, and tests are ready.

## 14. Additional acceptance criteria for unified intelligence

- Personal and team intelligence share one AZI architecture and consistent evidence/permission contracts.
- A project member receives guidance only about their own permitted responsibilities and project context.
- A project leader sees project-scoped facts only, never another member's private Planning or personal academic timetable.
- An incomplete task is never represented as proof that its owner did no work or lacks commitment.
- Personalized timing uses only available, current, authorized data and does not disclose private schedule details.
- AZI never creates or changes a personal Planning item without the student's explicit confirmation.
- Notifications are limited, dismissible, preference-controlled, and do not rely on always-on surveillance.
- Project access is enforced by backend authorization and RLS, not by hiding UI elements or trusting client-supplied IDs.
- If project schema, membership, dependency, or permission evidence is unavailable, AZI reports the limitation and does not invent team insights.
- Tests cover cross-member isolation, leader/member permission differences, missing or stale data, notification deduplication, and confirmation before writes.
