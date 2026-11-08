# AZ Projects — MVP Product & Technical Specification

**Status:** Approved direction; implementation scope proposed for review  
**Branch:** `feature/az-projects-mvp`  
**Product area:** AZ academic workspace  
**Language:** Arabic-first, English supported; RTL/LTR required

## 1. Product intent

AZ Projects gives a student team one shared place to plan, write, coordinate, and finish an academic project. It replaces the fragmented workflow of separate Word files, manual merging, scattered messages, unclear ownership, and last-minute status chasing.

**Product promise:** One team. One shared workspace. Clear ownership. A finished submission.

This is a collaborative academic workspace, not a general-purpose social network and not a clone of GitHub or Microsoft Word.

## 2. MVP outcomes

A team must be able to:

1. Create a private academic project and become its lead.
2. Invite teammates through a secure, expiring invitation link.
3. Open and edit the same primary project document.
4. See who is currently present and editing, with visible cursors where supported.
5. Create tasks, assign owners, set priorities and deadlines, and track status.
6. See a trustworthy activity feed showing task and document activity.
7. Ask the AZ Project Assistant for an evidence-based project status summary and suggested next actions.
8. Review a submission checklist before marking the project complete.

## 3. MVP scope

### 3.1 Project workspace

- Project title, short description, optional linked AZ subject, due date, and status.
- Private by default; only project members can access it.
- Project overview with progress, upcoming deadlines, outstanding work, members, and recent activity.
- **AZ-wide integration:** the project's due date is a single canonical project field. It appears automatically in every member's Planning and Home views; it must never be copied into separate personal task rows. Assigned project tasks appear in the assignee's Planning, while the full team task board remains in the project workspace.
- Changing or completing the project updates all relevant AZ surfaces from the same source of truth.
- One primary rich-text report/document in the first collaborative release.
- Project attachments (PDF, DOCX, PPTX, images) may be uploaded and downloaded; editing arbitrary file formats collaboratively is out of scope.
- The data model must not prevent multiple editable documents from being added later.

### 3.2 Team and permissions

Initial roles:

- **Lead:** creates and owns the project; manages invitations and membership; assigns/reassigns tasks; edits and manages the document; can archive or complete the project.
- **Member:** reads the project, edits the shared document, views tasks, and updates tasks assigned to them. Members may create tasks if enabled by the project policy.
- Viewer-only access is deferred unless required by the first usability test.

Rules:

- Membership is the source of truth for project access.
- A user must never gain access by guessing a project UUID or document identifier.
- Invitation links use high-entropy random tokens; only token hashes are stored.
- Invitations expire and are single-use by default.
- Accepting an invitation must verify the signed-in account and, when an invite is email-bound, match the invited email.
- Removing a member revokes future access to project data and collaboration channels. Existing WebSocket sessions must also be re-authorized/revoked promptly.

### 3.3 Shared document

- A structured rich-text editor, not a plain textarea.
- Multiple members can type at the same time.
- Show active collaborators and their cursors/selections where technically supported.
- Autosave with clear connection/saved/saving/error states.
- Concurrent edits must merge without silently overwriting another member's work.
- Reconnection must recover unsynced changes where possible.
- Basic formatting: headings, paragraphs, lists, numbered lists, quotes, links, and inline emphasis.
- Document history: retain recoverable checkpoints/snapshots. Full Git-style branching and pull requests are not MVP requirements.
- Export to DOCX/PDF can follow after core editing and persistence are stable; do not claim export until tested.

### 3.4 Tasks

Project tasks are shared project records, not duplicated personal tasks. Planning consumes them through a unified read model alongside personal tasks. A project deadline is a shared milestone visible to every project member; it is not an individually owned task.

Task fields:

- title and optional description
- assignee (project member)
- creator
- due date/time
- priority
- status: To do / In progress / Done
- created and updated timestamps
- optional link to a document section (later enhancement)

The lead can assign and reassign work. Members can update their own assigned task. All changes appear in the activity feed.

### 3.5 Activity and contribution history

Record meaningful events:

- project created
- member invited / joined / removed
- task created / assigned / reassigned / completed
- document edited (event metadata only; do not copy full document text into the feed)
- project deadline or status changed
- submission checklist completed

The feed must distinguish verified facts from generated suggestions. Do not infer effort or contribution quality from raw keystroke counts.

### 3.6 AZ Project Assistant

First release behavior:

- On-demand status brief for the lead, based on current project tasks, deadlines, membership, and recent activity.
- Identify overdue tasks, unassigned work, approaching deadlines, and stale tasks.
- Suggest a more balanced task distribution using explicit workload signals available in the project.
- Explain why each recommendation was made and link it to the relevant task or activity.
- The lead must approve any assignment or deadline change; the assistant never silently changes project data.
- The assistant must say when information is missing. It must not invent member progress, effort, or completion.
- AI provider integration remains gated by the AZ API-provider decision. Do not add a paid provider or create a subscription without the owner's approval. The UI and data contract can be prepared independently.

### 3.7 Submission checklist

A small configurable checklist for:

- all required sections present
- no open critical tasks
- attachments uploaded
- references/citations reviewed
- final formatting reviewed
- lead marks submission ready

This is a readiness aid, not a guarantee of academic correctness.

## 4. Explicit non-goals for the first release

- Full Microsoft Word feature parity.
- Real-time editing of DOCX/PPTX/Excel binaries.
- Git hosting, code repositories, branches, pull requests, or merge conflict workflows.
- Public community feeds, discovery, follower systems, or open groups.
- Voice/video meetings or live lecture recording.
- Automatic direct messages or reminders sent to teammates.
- Advanced resource scheduling or workload prediction without evidence.
- Large-enterprise project management.
- AI-generated claims about individual effort or quality.

## 5. Primary user journeys

### Journey A — Create and invite

1. Student creates a project.
2. Creator becomes Lead.
3. Lead sets title, description, due date, and optional subject.
4. AZ creates an invitation link with an expiry.
5. Teammates sign in, accept the invitation, and become Members.
6. The project overview updates to show the team.

### Journey B — Work together

1. Any member opens the primary document.
2. The editor loads the persisted document state.
3. Members edit concurrently and see collaborator presence/cursors.
4. Changes are synchronized and persisted.
5. The project feed records document activity without exposing full text.

### Journey C — Coordinate work

1. Lead creates tasks and assigns members.
2. Each member sees their assigned work and deadlines.
3. Members update task status.
4. The overview and activity feed update.
5. Lead requests a status brief and reviews AZ's evidence-backed recommendations.

### Journey D — Prepare submission

1. Team reviews outstanding tasks.
2. Team completes the checklist.
3. Lead marks the project ready or complete.
4. The project remains available for read-only review according to retention policy.

## 6. Proposed data model

Names are proposed; final SQL must be reconciled with the live schema and migration history before implementation.

- `projects`: id, owner_id, subject_id (nullable), title, description, due_at, status, created_at, updated_at.
- `project_members`: project_id, user_id, role, joined_at, invited_by.
- `project_invitations`: id, project_id, token_hash, invited_email (nullable), role, expires_at, accepted_at, created_by, created_at.
- `project_documents`: id, project_id, title, document_key, created_at, updated_at.
- `project_tasks`: id, project_id, title, description, assignee_id (nullable), created_by, due_at, priority, status, created_at, updated_at, completed_at.
- `project_activity`: id, project_id, actor_id (nullable for system events), event_type, payload (sanitized JSON), created_at.
- `project_attachments`: id, project_id, uploaded_by, storage_path, filename, mime_type, byte_size, created_at.
- `project_document_snapshots` (or equivalent persistence owned by the collaboration service): document_id, binary snapshot, version/checkpoint metadata, created_at.

Use composite foreign keys where appropriate to ensure task assignees and document references belong to the same project. Enable RLS on every exposed public table. Add explicit Data API grants for new public tables because current Supabase projects no longer automatically expose new tables by default.

## 7. AZ-wide integration requirements

- Projects are first-class academic entities, not an isolated Community feature.
- The canonical project deadline is stored once on `projects.due_at`.
- A unified `planning_items` read model combines personal tasks, each member's assigned project tasks, and shared project deadlines.
- Home, Planning, notifications, and future Weekly Review should consume the same project/task records rather than creating shadow copies.
- A project deadline change must propagate to every member's Planning/Home view without each member manually adding or syncing it.
- Project task completion and project status must be reflected consistently in project overview and relevant personal views.
- Navigation should preserve context: opening a project item from Planning should deep-link to that project and task; opening the project deadline should open the project overview.

## 8. Security and privacy requirements

- All project tables have RLS enabled before client access is granted.
- Project reads require membership; project writes require role-appropriate membership.
- Leads alone manage membership and invitations.
- Members can only update tasks they are allowed to update.
- Validate invitation tokens server-side; never expose raw stored tokens.
- Use private Realtime channels and membership-aware authorization.
- Do not use user-editable `user_metadata` for authorization decisions.
- Never expose Supabase service-role/secret keys in browser code.
- Store attachments in a private bucket and authorize access through project membership.
- Keep document collaboration authorization separate from the editor UI: the WebSocket server must validate the Supabase user and project membership before joining a document.
- Revocation and role changes must invalidate active collaboration access, not only future page loads.
- Audit cross-project access with two independent test users.

## 9. Technical direction — proposed, subject to a proof of concept

### Client

- React 19 + Vite (existing app).
- Tiptap editor with Yjs collaboration.
- Yjs is the shared document model; do not synchronize the editor by replacing the entire HTML/text value on every keystroke.
- Use a provider abstraction so the transport can be changed without rewriting the editor UI.

### Application data

- Supabase Postgres for projects, membership, invitations, tasks, activity, and relational metadata.
- Supabase Auth for identity.
- Supabase Storage for private attachments.
- Supabase Realtime for project activity/presence notifications where appropriate, using private channels and membership-aware RLS.

### Collaborative document transport and persistence

Evaluate a self-hosted Yjs/Hocuspocus v4 WebSocket service on Cloudflare Workers, with per-document coordination/persistence using Cloudflare Durable Objects where the runtime integration proves reliable. Hocuspocus v4 documents support for Cloudflare Workers; Durable Objects are designed for coordinated WebSocket applications.

Before committing to this architecture, build a technical spike that verifies:
1. WebSocket upgrade and reconnect behavior on Cloudflare.
2. Authentication from a Supabase JWT.
3. Membership authorization before document access.
4. Two clients editing simultaneously with no lost updates.
5. Durable persistence and recovery after service restart/hibernation.
6. Revoking a member while a session is active.

Fallback: use a Yjs provider over Supabase Realtime Broadcast with durable Yjs binary updates/snapshots stored in Postgres, if the Cloudflare integration adds disproportionate complexity. Do not use Realtime Broadcast's short-lived message retention as the document's source of truth.

No paid collaboration service is selected or approved at this stage.

## 10. Design requirements

- Follow the AZ_promo_v5 visual reference: dark spatial workspace, charcoal layered panels, restrained cyan/blue/violet accents, clear hierarchy, and purposeful motion.
- Keep the editor readable and calm; the document itself must dominate the working area.
- Workspace layout: project identity and deadline, document/editor as primary canvas, tasks and team context in adjacent panels or tabs.
- Keep the project lead's status brief visible without turning the workspace into a generic admin dashboard.
- Arabic-first with correct RTL editing behavior, mixed Arabic/English content, keyboard shortcuts, and responsive layout.
- Presence colors must be curated and accessible, not arbitrary rainbow decoration.
- Respect reduced-motion settings and keyboard accessibility.

## 11. Delivery phases

### Phase 0 — Foundation and spike
- Confirm the current app architecture and database policies.
- Create this feature branch and keep changes isolated from `main`.
- Build a minimal Yjs/Tiptap collaboration proof of concept with two browser clients.
- Verify the chosen Cloudflare/Supabase authentication and persistence path.

### Phase 1 — Project core
- Database migrations and RLS.
- Create project, membership, invitations, and project overview.
- Task creation, assignment, deadlines, status, and activity feed.

### Phase 2 — Shared document
- Tiptap rich-text editor.
- Yjs collaboration transport.
- Presence/cursors, autosave state, reconnect behavior, and checkpoints.
- Arabic/English and RTL/LTR tests.

### Phase 3 — Project Intelligence
- Deterministic status summary from real project data.
- AI assistant integration after AZ's AI provider decision.
- Suggestions require lead approval and are auditable.

### Phase 4 — Beta hardening
- Two-user and multi-tab tests.
- Permission and invitation abuse tests.
- Network interruption and concurrent edit tests.
- Responsive, accessibility, performance, and security review.
- Usage/cost measurement for AI features.

## 12. Definition of done

The MVP is not done until:

- A lead can create a private project and invite at least three teammates.
- Only invited members can access project data and documents.
- Two or more members can edit the same document simultaneously without lost updates.
- Refreshing or reconnecting restores the latest persisted content.
- Tasks can be assigned, updated, and tracked with reliable deadlines.
- The activity feed reflects actual project events.
- The lead can obtain a status report grounded in current task/activity data.
- The app works in Arabic RTL and English LTR on desktop and mobile widths.
- Automated tests cover role permissions, invitation expiry/reuse, cross-project isolation, and concurrent document edits.
- No secret key is present in client bundles.

## 13. Decisions still open

1. Final collaboration transport after the proof of concept.
2. Whether invitations are link-only initially or also email-bound.
3. Whether the first release includes a second editable document or keeps one primary report plus attachments.
4. Whether AI status summaries ship in the first public beta or initially use a deterministic report until the AI provider is selected.
5. Document checkpoint frequency and retention limits.
