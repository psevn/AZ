# AZ Planning & Academic Setup — Product Specification

**Status:** Product direction draft for review  
**Product:** AZ — The Academic Universe  
**Scope:** V1 foundation, with clearly separated later enhancements

## 1. Product purpose

Planning is not a generic to-do list. It is the student's academic operating space: subjects, recurring class meetings, assignments, deadlines, exams, and study tasks connected in one coherent system.

The product should combine:
- The clarity and speed of Todoist-style task capture, priorities, recurring tasks, filters, and focused task lists.
- The flexibility and structured information of Notion-style subject spaces, properties, notes, and multiple ways to view related information.
- An academic-first model that connects Planning to Home, Focus, and the AZ Study Workspace.

The goal is not to clone either product feature-for-feature. Academic clarity and low-friction daily use take priority.

## 2. Core principles

1. **Useful before empty:** First-time students should be guided to add their academic basics, but must be able to skip setup and use AZ immediately.
2. **Progressive setup:** Ask for essential information first. Optional details can be added later.
3. **One source of truth:** A subject, class meeting, task, or exam is created once and reused in every relevant view.
4. **Fast capture:** Adding a task or subject should take seconds, not require filling a long form.
5. **Student control:** AZ may suggest a study plan later, but must not silently invent deadlines or schedule study sessions without confirmation.
6. **Safe changes:** Archiving a subject must not silently delete its tasks, documents, or history.
7. **Accessible everywhere:** Arabic RTL and English LTR, keyboard, touch, responsive layouts, and reduced-motion support.
8. **Performance first:** Planning remains calm and information-dense; cosmic effects must never reduce readability or task completion speed.

## 3. First-run experience — AZ Academic Setup

### Entry conditions
- Show setup after a user's first successful sign-in when their academic setup is incomplete.
- Persist setup progress so a refresh or later return does not restart the flow.
- Provide **Set up my AZ** and **I'll do this later** actions.
- Skipping setup must never block access to Home, Planning, or AZ.
- Allow the user to reopen and edit setup later from Me / Settings.

### Step 1 — Academic term (recommended, skippable)
- Term name, e.g. Fall 2026.
- Start and end dates are optional in the first pass.
- The student can continue without defining a term.
- Do not assume a country's semester structure or academic calendar.

### Step 2 — Subjects
For each subject:
- Required: subject name.
- Optional: course code, instructor, color, short description.
- Add multiple subjects in one flow.
- Allow quick add, edit, archive, and restore later.
- Prevent accidental duplicate entries only with a gentle warning; do not block legitimate similarly named subjects.

### Step 3 — Weekly class timetable (optional per subject)
For each recurring class meeting:
- Subject.
- Day of week.
- Start time and end time.
- Optional location / room and meeting label (lecture, lab, tutorial).
- Support multiple meetings for one subject and multiple meetings on one day.
- Provide add, edit, and remove actions.
- Show a weekly preview before finishing.
- Handle overlapping meetings with a clear warning, not silent rejection.
- Store times consistently and display in the student's local timezone.

### Step 4 — Study availability (optional)
- Preferred study days and time windows.
- Optional rest / unavailable windows.
- This is preference data, not a promise that AZ will automatically fill the calendar.
- May be used by future planning suggestions; no automatic time-blocking in the initial V1.

### Finish
- Show a concise review: subjects, weekly class meetings, and availability if entered.
- Confirm and create the student's academic space.
- Take the student to Planning with a useful first view, not an empty dashboard.
- If the student added subjects but no tasks, offer a clear first-task action.

### Setup editing
- Reopening setup edits existing records; it must not duplicate subjects or class meetings.
- Users can add more subjects and meetings at any time directly from Planning.
- A student who skipped setup can complete any step later.

## 4. Planning information architecture

Planning has four primary views over shared data:

1. **Today** — tasks due today, overdue tasks that need attention, today's class meetings, and a clear next action.
2. **Upcoming** — upcoming tasks, exams, and class meetings in chronological order.
3. **Calendar** — weekly calendar showing recurring classes and dated tasks / exams.
4. **All tasks** — searchable and filterable task list, with list and board presentation.

The initial view should be Today. Keep navigation compact and avoid making users learn a complex workspace before they can add a task.

### Subject spaces
Each subject has a dedicated detail view containing:
- Subject identity and optional metadata.
- Upcoming class meetings.
- Tasks and deadlines for that subject.
- Exams / assessment dates.
- Related study documents when the AZ workspace integration is ready.
- Subject progress based on completed tasks and study activity, with transparent definitions.

Subject details must remain useful even if optional fields are blank.

## 5. Task model and capabilities

### V1 task fields
- Title (required).
- Subject (optional).
- Due date and optional due time.
- Priority: low, medium, high.
- Status: To do, In progress, Done.
- Estimated duration.
- Description / notes (optional).
- Created and updated timestamps.

### V1 task actions
- Quick add from Planning and Home.
- Edit and delete with confirmation where destructive.
- Mark complete / reopen.
- Change status and priority.
- Assign or change subject.
- Search and filter by status, subject, priority, and due window.
- Sort by due date, priority, or recently created.
- Bulk actions can be deferred unless they prove necessary for the initial launch.

### Later task enhancements
- Subtasks / checklists.
- Labels and custom properties.
- Recurring tasks with flexible rules.
- Saved filters / custom views.
- Attachments and richer notes.
- Natural-language task entry.
- Task dependencies and advanced project boards.

Do not implement advanced recurrence until timezone, daylight-saving, and exception behavior are specified and tested.

## 6. Calendar and timetable behavior

### V1
- Weekly calendar view.
- Recurring class meetings shown in their correct weekday/time slots.
- Dated tasks and exams shown on their relevant dates.
- Clear visual distinction between fixed class meetings and movable tasks.
- Clicking an item opens its detail/edit view.
- Week navigation and a Today shortcut.
- A list fallback for narrow screens and accessibility.
- No drag-and-drop scheduling in the first V1.

### Later
- Drag-and-drop time blocking.
- External calendar sync.
- Calendar import from files or university systems.
- Smart schedule suggestions and conflict-aware auto-planning.

## 7. Connections across AZ

- Subject created in Planning becomes available in AZ Workspace and document organization.
- Class meetings appear in Planning Today / Calendar.
- Tasks appear in Home and Planning views.
- Starting Focus from a task links the focus session to that task.
- Exam dates can power Home countdowns.
- Study documents and quizzes should be associated with a subject when those features are implemented.
- Completion and progress indicators must use actual stored records, not decorative or fabricated values.

## 8. Data and integrity requirements

The current application already has subjects and tasks. Current frontend task fields include subject_id, title, due_at, priority, est_minutes, and status.

Before implementation, inspect the live Supabase schema and migrations. Do not assume this specification's optional fields already exist.

Likely schema additions to evaluate:
- Subject metadata: course code, instructor, description, archive timestamp, and term relation if needed.
- Academic terms / semesters.
- Recurring class meeting definitions (weekday, start/end local time, location, meeting type, active date range).
- Student study-availability preferences.
- Exam / assessment records, or a clearly typed task representation if that is safer for V1.
- Task description and optional due time.

Requirements:
- Every user-owned record must be protected by RLS and scoped to the authenticated user.
- Add foreign keys and indexes for common user/subject/date queries.
- Preserve existing data and relationships during migrations.
- Define deletion and archival behavior before shipping.
- Never expose service-role credentials in the browser.
- Validate time ranges, date ranges, and ownership server-side / through database constraints where appropriate.

### Current database audit (read-only snapshot — 2026-11-05)

The live project was inspected without changing its schema.

- `public.subjects` currently has: id, user_id, name, color, created_at, and exam_date.
- `public.tasks` currently has: id, user_id, subject_id, title, due_at, priority, est_minutes, status, created_at, and note.
- `public.profiles` currently has: id, display_name, language, created_at, plan, and deletion_requested_at.
- `public.focus_sessions` already links an optional task_id.
- `public.documents` already links an optional subject_id.
- There is currently no academic-term table, recurring class-meeting table, study-availability table, or persisted onboarding-progress field in profiles.
- RLS is enabled on subjects and tasks. Their current ALL policies scope both USING and WITH CHECK to the authenticated user's id.
- Existing subject exam_date and task note should be evaluated and reused before adding overlapping fields.

This means the timetable and resumable Academic Setup require a carefully designed additive schema change. The current exam_date field may be sufficient for a simple single exam date per subject in the earliest slice, but a separate assessment model may be needed if multiple exams or assignments per subject are required.

No database changes were made during this audit.

## 8A. Proposed additive database design (reviewed 2026-11-05)

This is the recommended V1 shape based on the live schema. It is a design proposal, not an executed migration.

### Keep and extend existing tables

**profiles**
- Keep existing identity, display name, language, plan, and deletion fields.
- Add `timezone` (IANA timezone name, nullable until detected/confirmed).
- Add `academic_setup_status` with controlled values: `not_started`, `in_progress`, `skipped`, `completed`.
- Add `academic_setup_step` for resumable progress, nullable.
- Add `academic_setup_completed_at` and optionally `academic_setup_skipped_at`.
- Update setup fields only for the authenticated profile owner.

**subjects**
- Keep `id`, `user_id`, `name`, `color`, `exam_date`, and `created_at`.
- Add nullable `term_id`, `course_code`, `instructor`, `description`, and `archived_at`.
- Keep `exam_date` for backward compatibility in V1; don't remove or rename it while the current UI uses it.
- Archive by setting `archived_at`; default subject pickers hide archived subjects but history remains accessible.
- Avoid hard deletion in normal UI. If a user explicitly deletes a subject, preserve existing FK behavior that detaches tasks/documents rather than deleting the user's learning history.

**tasks**
- Keep the current fields and semantics: `subject_id`, `title`, `due_at`, `priority`, `est_minutes`, `status`, and `note`.
- Treat `due_at` as the actual deadline timestamp; display in the profile timezone.
- Do not add recurrence, subtasks, labels, or arbitrary custom properties to the first schema migration.
- If richer descriptions are needed, first decide whether existing `note` can serve that purpose rather than creating duplicate fields.

### New tables

**academic_terms**
- `id` UUID primary key.
- `user_id` UUID owner.
- `name` required.
- `start_date`, `end_date` optional dates.
- `is_active` boolean; at most one active term per user.
- `created_at` timestamp.
- Unique composite key `(id, user_id)` to support owner-safe relationships.
- Validate end_date is not before start_date.
- Keep old terms for history; switching active term must not erase subjects or tasks.

**class_meetings**
- `id` UUID primary key.
- `user_id` UUID owner.
- `subject_id` UUID required.
- `weekday` smallint using ISO numbering (1 Monday … 7 Sunday).
- `starts_at_local`, `ends_at_local` as TIME WITHOUT TIME ZONE because a recurring lecture is a local wall-clock event, not one UTC instant.
- `timezone` IANA timezone name, stored per meeting or inherited from the profile at creation and then persisted.
- `location` and `meeting_type` optional (lecture, lab, tutorial, other).
- `valid_from`, `valid_until` optional dates to support term-specific weeks.
- `created_at`.
- Validate weekday 1–7 and end time after start time. If overnight meetings are ever required, define that behavior explicitly rather than silently allowing it.
- Use a composite foreign key `(subject_id, user_id)` to `subjects(id, user_id)` so a meeting cannot reference another user's subject.
- Index by `(user_id, weekday, starts_at_local)` and `(subject_id, user_id)`.

### Relationships and security

- `academic_terms` 1-to-many `subjects` (term optional).
- `subjects` 1-to-many `class_meetings`.
- Existing `subjects` 1-to-many `tasks` remains.
- Existing tasks-to-focus-sessions and subjects-to-documents relationships remain intact.
- Enable RLS on both new tables. Policies for SELECT/INSERT/UPDATE/DELETE must scope `user_id = auth.uid()` in USING and WITH CHECK as applicable.
- Use composite owner-aware foreign keys wherever a child row references a user's parent row. RLS is not a replacement for relational ownership constraints.
- Add indexes only for real query paths; avoid redundant indexes already covered by existing ones.
- Keep all migrations additive and reversible where practical. Do not drop or repurpose existing columns during V1.
- Subject archival must not cascade-delete tasks, documents, or focus history.

### Decisions deliberately deferred

- **Study availability:** Keep out of the first migration. It becomes useful when AZ is ready to suggest time blocks; collecting it before that adds onboarding friction without immediate value.
- **Multiple assessments per subject:** Current `subjects.exam_date` supports one date per subject. Revisit a dedicated `assessments` table if students need multiple exams/quizzes/projects per subject in the initial calendar. Do not overload task rows with hidden semantics without a clear UI.
- **Task recurrence / subtasks / labels:** defer until the core schedule and task experience is stable.
- **Semester imports / university integrations:** later.

### Migration order

1. Confirm exact current constraints and client usage; capture a schema backup / migration baseline.
2. Add `academic_terms` and `class_meetings` with owner-safe constraints and RLS.
3. Add nullable metadata and setup-progress columns to existing tables.
4. Add indexes and validation constraints.
5. Test two separate users to prove cross-user references and reads/writes are blocked.
6. Update the frontend in small steps; keep existing task and subject flows working throughout.

## 9. V1 priority and release boundary

### V1 foundation — required
- First-run Academic Setup with skip and resume.
- Create, edit, and archive subjects.
- Weekly recurring class timetable.
- Task CRUD with subject association, due date, priority, status, and estimate.
- Today, Upcoming, and All Tasks views.
- Weekly calendar view with classes and dated tasks.
- Search and practical filters.
- Home and Focus integration.
- Arabic / English and responsive RTL / LTR behavior.
- RLS, data integrity, and account data isolation.

### V1 preferred if time permits
- Subject detail pages.
- Exam / assessment dates and Home countdown.
- Task descriptions / notes.
- Study availability preferences.
- Calendar/list toggle refinements.

### Post-V1
- Notion-like arbitrary databases and custom properties.
- Advanced Todoist-style recurring rules.
- Subtasks, labels, saved views, dependencies, and bulk editing.
- Drag-and-drop time blocking.
- Automatic AI schedule generation.
- External calendar integrations and timetable import.
- Collaboration and shared academic spaces.

## 10. UX quality bar

- A user can add a subject without opening a long setup form.
- A user can add a task in a few seconds.
- A student with no timetable can still use Planning fully.
- A student with no subjects can create a general task.
- Setup can be skipped, resumed, and edited without data duplication.
- Conflicts and destructive actions are explained clearly.
- Empty states tell the user what to do next.
- Loading, error, success, and offline / network failure states are designed.
- The interface is tested with Arabic RTL and English LTR, keyboard navigation, touch, and a narrow mobile viewport.

## 11. Implementation sequence

1. Audit existing Supabase tables, RLS policies, frontend queries, and current task/subject behavior.
2. Confirm the V1 schema and migration plan without deleting or breaking existing records.
3. Build the subject and class timetable foundation.
4. Build the Academic Setup flow with skip / resume.
5. Upgrade task capture, list, and filters.
6. Add Today / Upcoming / weekly Calendar views.
7. Connect Planning to Home and Focus.
8. Run build, migration checks, RLS checks, and manual Arabic / English responsive tests.

**No schema migration or destructive data change is authorized by this specification alone.**
