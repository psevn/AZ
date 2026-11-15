# AZ Planning — V1 spec (proposal)

**Status:** Direction approved by PSEVN on 2026-11-15. Technical review and the open questions in section 7 are still pending, and nothing is implemented. Planning is expected to keep evolving after V1 (P1 and P2 below).
**Owner intent (2026-11-15):** Planning combines the best of Todoist and Notion, stays easy for students, and builds a positive daily habit so the student enjoys their day. Decided earlier (2026-11-09): quick capture, Today/Upcoming views, date chips and subject chips right after typing a task.
**Inherits rules from:** `docs/product/AZ-INTELLIGENCE-IDENTITY.md` and `CLAUDE.md` (student control, no surveillance feel, no interrupting, approval for consequential actions).
**Related:** `AZI-V1-LITE.md` (insights and care loop), `PROJECTS-SPEC.md` (project tasks), `PRICING.md` (Planning is free).

## 1. Principles
1. **Capture in seconds, decide in one glance.** Adding a task takes one field and one tap. The day fits on one screen.
2. **Few things per day.** Today highlights at most 3 priorities; everything else sits below.
3. **Habit, not compulsion.** The student returns because Planning lowers stress and shows real progress. No guilt, no punishment for a missed day.
4. **The student decides.** AZ suggests; nothing is rescheduled or added without approval.
5. **No customization sprawl.** No custom databases, properties or relations. Flexibility is what makes planners get abandoned.
6. **Rules first.** Everything in this spec runs on data and rules, with no AI API cost.

## 2. Observed data (live Supabase project `AZ`, re-checked 2026-11-15)
- `tasks`: title, `due_at`, `priority` (1–3), `est_minutes`, `status` (todo, doing, done), `note` (up to 5000 chars), `subject_id`, `completed_at`.
- `planning_items` (view): unifies personal tasks and project tasks (`item_type`, `project_id`, `project_title`). Today and Upcoming read from it.
- `class_meetings` (weekday, local start and end time, timezone, valid range), `subjects.exam_date`, `focus_sessions` linked to a task, `academic_setup.timezone`.
- Not present: recurrence, subtasks, labels, link from a task to a document or page, day-closing records.
- Day boundaries ("today") must use the student's timezone (`academic_setup.timezone`), not the server's.

## 3. V1 scope
**P0 (beta-critical)**
- **Quick capture:** one field, always reachable. After typing, show date chips (today, tomorrow, this week) and subject chips. No natural-language parsing in V1.
- **Today:** top 3 priorities, then the rest of today's items, class meetings and exams of the day in one list (rule-based ordering by due time, priority, exam proximity).
- **Upcoming:** items grouped by day.
- **Task note:** the existing `note` field.
- **Focus from a task:** start the existing focus timer from any task.
- **Close the day (about 30 seconds):** review today's items; done items are recorded, unfinished ones move to tomorrow in one tap or are dismissed. Show a plain summary with real numbers (for example "3 of 4 done, 55 minutes focus").
- **Overdue handling:** overdue items are not a red wall. They collect in a "reschedule" tray with one-tap move to today, tomorrow or this week.

**P1 (after beta feedback)**
- Link a task to a study material (document and page), so the task opens the PDF where the student should work. Needs a schema change.
- Recurring tasks, including a "repeat after completion" option. Needs new fields.
- **Exam plan generator:** from `subjects.exam_date`, propose study tasks counting back from the exam (rule-based). The student reviews and approves before anything is created.
- Timeline or calendar view of the day and week.
- Task breakdown templates (for example "assignment", "exam prep") that create a few subtasks or linked tasks.

**P2 / later**
- AI task breakdown with time estimates (metered, charged to the user who triggers it).
- AZI suggestions to move or add sessions, always with approval.
- Calendar import or sync (Google, Outlook). Decide with beta evidence.
- Todoist/Notion import as an acquisition tool.

**Out of scope for V1:** custom databases and properties, Kanban, nested projects, many labels, automatic rescheduling without approval, location reminders.

## 4. Habit design
- **Loop:** morning clarity (Today, 3 priorities) → small wins while working (done feedback such as "2 of 3") → evening close → short weekly review.
- **Consistency indicator:** "days you planned this week" instead of a streak that resets to zero. A missed day does not erase progress.
- **Nudges:** at most one proactive message per day, off by default for anything outside the app, and always switchable off by the student.
- **Avoid:** guilt notifications, point deductions for overdue tasks, infinite feeds, random rewards, any claim that AZ "knows" the student beyond the evidence.
- **Tone:** neutral, supportive, real numbers only.

## 5. Design references (what was studied and what to take)
Observed from product pages and review articles read on 2026-11-15. Several articles are published by competing vendors, so their rankings and opinions are not treated as facts; only feature descriptions are used.
| Reference | Take | Avoid |
|---|---|---|
| Todoist | Very fast capture; natural-language dates; recurring option based on completion; filters; vacation mode that preserves streaks | Karma that deducts points for overdue tasks |
| Things 3 (as described in a review) | Today, Upcoming and Areas structure; polish | Apple-only dependence is irrelevant to AZ |
| TickTick | Focus timer, habits and calendar in one app | A busier interface |
| Sunsama | Guided daily ritual (review yesterday, plan, prioritize, prepare) and a shutdown idea | Price and the need for another task app |
| Tiimo | Visual day timeline with colors and icons; step breakdown with time estimates; progress-ring timer | AI features cost money per use; trophy-style streaks |
| Motion, Reclaim | Idea of protecting focus time | Automatic constant reshuffling; reviewers report loss of control and trust |
| Notion | Notes inside tasks | Setup time and endless tweaking |
| MyStudyLife and Structured (student-oriented) | Timetable including rotating schedules, per-subject assignments, exam and revision reminders, drag-and-drop day | None identified |
Opportunity: in the pages read, none described linking a planned task to the student's own study material or practice results. That link is where AZ can differ.

## 6. Proposed data changes (review before any migration)
- `tasks`: optional link to a document and page (P1); recurrence fields (P1).
- `day_closures(user_id, local_date, planned_count, done_count, closed_at)` to support the close-the-day summary and the "days you planned" indicator. Follow the existing RLS pattern with `user_id`.
- No changes to `planning_items` semantics without checking project tasks.

## 7. Open questions
1. Exact definition of "a planned day" for the consistency indicator.
2. Top-3 selection rule: how due time, priority, exam proximity and weak topics (from AZI) are weighted.
3. Whether calendar sync is needed for beta or can wait.
4. Offline behavior (a student-oriented app reportedly offers it); is it required for V1?
5. Arabic/English and RTL behavior of chips, dates and the Hijri versus Gregorian calendar question.
6. How project tasks appear in Today and who can change their status.

## 8. Success measures (to calibrate in beta)
- Share of beta students who add a task within the first session; time to add a task.
- Days per week with a plan; planned versus completed.
- Close-the-day completion rate.
- D7 and D30 retention.
- One beta question: did AZ reduce stress about studying?
No targets are set until beta data exists.
