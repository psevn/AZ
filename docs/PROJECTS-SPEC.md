# AZ Group Projects — spec (proposal + as-built observation)

**Status:** PROPOSAL for owner review. Group Projects are part of V1 by PSEVN's decision of 2026-11-08. Nothing in this file approves new scope; open items need a decision.
**Source of the "as-built" section:** read-only inspection of the live Supabase project `AZ` on 2026-11-15 (table and column listing only). A staging project `AZ-Staging` also exists and was not inspected.
**Drift warning:** the Projects tables exist in the live project but no migration in `supabase/migrations` on `main` mentions them (the latest file there is `20261105160000_add_academic_planning_foundation.sql`). The repo cannot currently recreate the live schema. Resolve before relying on this document.

## 1. Purpose
Let students run a private team project for a course: members, a deadline, tasks with assignees, a shared report document, attachments and an activity log. A leader can see who has done what.

## 2. As-built schema (observed 2026-11-15, all RLS enabled, all tables empty)
| Table | Purpose and key fields |
|---|---|
| `projects` | `created_by`, optional `subject_id`, `title`, `description`, `due_at`, `status` (active, completed, archived). Comment on the table says project `due_at` is surfaced through `planning_items` for every member. |
| `project_members` | `(project_id, user_id)`, `role` (lead or member), `invited_by`. |
| `project_invitations` | `token_hash` (unique), optional `invited_email`, `role` (member only), `expires_at`, `accepted_at`. |
| `project_tasks` | `title`, `description`, `assignee_id` (must be a project member), `due_at`, `priority` (1–3), `est_minutes`, `status` (todo, doing, done), `completed_at`. |
| `project_documents` | `title`, `document_type` (report, notes, other), `is_primary`. Content storage not observed. |
| `project_attachments` | `storage_path` (unique), `filename`, `mime_type`, `byte_size`. |
| `project_activity` | `actor_id`, `event_type` (project created, member joined or removed, task created, assigned, reassigned, status changed, completed, document created or edited, deadline changed, project completed or archived, attachment uploaded), `payload` jsonb. |

Differences from the personal tables: project tables have no `user_id` column. Access is by membership, so RLS must check `project_members`, not `user_id = auth.uid()`. The "composite FK on (id, user_id)" pattern of the personal tables does not apply and needs its own review.

## 3. Roles and permissions (proposal)
- `lead`: edits project details and deadline, invites and removes members, assigns tasks, sees the status panel, approves reminders.
- `member`: sees the project, updates the status of tasks assigned to them, edits shared documents, uploads attachments.
- Invitations are single-purpose, expiring, stored only as a hash. Only `member` role can be invited; leadership transfer is an open question.
- Removing a member must not delete their personal data; it only ends access to the project.

## 4. Status model for the leader view
Derived from `project_tasks` and `project_activity`, with no new tables:
- Submitted: all of a member's assigned tasks are `done`.
- In progress: at least one is `doing`.
- Not started: all are `todo`.
- Part complete: split a share into several tasks; "half" means about half are `done`. There is no percent field and none is needed.
- Last activity: latest relevant `project_activity` event.
- If statuses were never updated, show "no update", never an estimate.
AZI presentation of this view is specified in `AZI-V1-LITE.md` §12.

## 5. Privacy rules
- Project views read `project_*` data only, never a member's private quizzes, mistakes, weak topics, focus time or files.
- Each member can see what the leader sees about them.
- Neutral wording for status, no shaming language.
- Attachments and documents are visible only to current members.
- Account deletion: define what happens to a deleted user's project tasks, activity and attachments (open question).

## 6. Cost
Everything above is database reads and templates, so it carries no AI API cost. Any optional AI feature (drafting a message, summarizing project state) goes through the credit system and is charged to the user who triggers it. Per `PRICING.md`, Projects are free; attachments and documents need storage limits.

## 7. Open questions
1. Reconcile the live schema with the repo: add the Projects migrations to `supabase/migrations`, or confirm where they live.
2. Where project documents are stored (rows, Storage, or both) and how concurrent editing is handled.
3. Storage limits per project and per member.
4. Leadership transfer, and what happens if the leader leaves.
5. Whether a member may be in unlimited projects.
6. Notifications: there is no notifications table. In-app only for V1?
7. Deleted-account handling for shared project data.
8. RLS and function review (membership checks, invite acceptance) by a second reviewer before any real users.

## 8. Priorities (proposal)
- **P0:** create project, invite and join, member list with roles, tasks with assignees and status, project deadline in Planning, RLS review.
- **P1:** shared document, attachments with limits, leader status panel, activity feed.
- **P2:** AZI reminders and summaries (see `AZI-V1-LITE.md` §12), leadership transfer.
- **Out of V1:** Community, live gatherings, public project discovery.
