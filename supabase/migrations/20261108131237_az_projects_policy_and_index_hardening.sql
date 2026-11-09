-- Recovered on 2026-11-09 by introspecting the live AZ Supabase schema.
-- This is a schema-equivalent reconstruction, not the original migration text.

create index if not exists projects_created_by_idx on public.projects(created_by);
create index if not exists projects_due_at_idx on public.projects(due_at) where due_at is not null;
create index if not exists projects_subject_owner_idx on public.projects(subject_id, created_by);
create index if not exists project_members_user_project_idx on public.project_members(user_id, project_id);
create index if not exists project_members_invited_by_idx on public.project_members(invited_by);
create index if not exists project_invitations_project_expiry_idx on public.project_invitations(project_id, expires_at);
create index if not exists project_invitations_created_by_idx on public.project_invitations(created_by);
create unique index if not exists project_documents_one_primary_idx on public.project_documents(project_id) where is_primary;
create index if not exists project_documents_created_by_idx on public.project_documents(created_by);
create index if not exists project_tasks_project_status_idx on public.project_tasks(project_id, status);
create index if not exists project_tasks_project_assignee_idx on public.project_tasks(project_id, assignee_id);
create index if not exists project_tasks_assignee_due_idx on public.project_tasks(assignee_id, due_at) where due_at is not null;
create index if not exists project_tasks_created_by_idx on public.project_tasks(created_by);
create index if not exists project_activity_project_created_idx on public.project_activity(project_id, created_at desc);
create index if not exists project_activity_actor_idx on public.project_activity(actor_id);
create index if not exists project_attachments_project_idx on public.project_attachments(project_id);
create index if not exists project_attachments_uploaded_by_idx on public.project_attachments(uploaded_by);

drop policy if exists projects_select_members on public.projects;
create policy projects_select_members on public.projects for select to authenticated
using (private.is_project_member(id));

drop policy if exists projects_insert_creator on public.projects;
create policy projects_insert_creator on public.projects for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists projects_update_lead on public.projects;
create policy projects_update_lead on public.projects for update to authenticated
using (private.is_project_lead(id))
with check (private.is_project_lead(id));

drop policy if exists projects_delete_lead on public.projects;
create policy projects_delete_lead on public.projects for delete to authenticated
using (private.is_project_lead(id));

drop policy if exists project_members_select_team on public.project_members;
create policy project_members_select_team on public.project_members for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists project_members_insert_lead_or_creator on public.project_members;
create policy project_members_insert_lead_or_creator on public.project_members for insert to authenticated
with check (
  ((user_id = (select auth.uid()) and role = 'lead') and private.is_project_creator(project_id))
  or private.is_project_lead(project_id)
);

drop policy if exists project_members_update_lead on public.project_members;
create policy project_members_update_lead on public.project_members for update to authenticated
using (private.is_project_lead(project_id))
with check (private.is_project_lead(project_id));

drop policy if exists project_members_delete_lead on public.project_members;
create policy project_members_delete_lead on public.project_members for delete to authenticated
using (private.is_project_lead(project_id) and user_id <> (select auth.uid()));

drop policy if exists project_invitations_no_client_access on public.project_invitations;
create policy project_invitations_no_client_access on public.project_invitations for all to authenticated
using (false) with check (false);

drop policy if exists project_documents_select_members on public.project_documents;
create policy project_documents_select_members on public.project_documents for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists project_documents_insert_members on public.project_documents;
create policy project_documents_insert_members on public.project_documents for insert to authenticated
with check (private.is_project_member(project_id) and created_by = (select auth.uid()));

drop policy if exists project_documents_update_lead on public.project_documents;
create policy project_documents_update_lead on public.project_documents for update to authenticated
using (private.is_project_lead(project_id))
with check (private.is_project_lead(project_id));

drop policy if exists project_documents_delete_lead on public.project_documents;
create policy project_documents_delete_lead on public.project_documents for delete to authenticated
using (private.is_project_lead(project_id));

drop policy if exists project_tasks_select_members on public.project_tasks;
create policy project_tasks_select_members on public.project_tasks for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists project_tasks_insert_members on public.project_tasks;
create policy project_tasks_insert_members on public.project_tasks for insert to authenticated
with check (
  private.is_project_member(project_id)
  and created_by = (select auth.uid())
  and (
    (private.is_project_lead(project_id)
      and (assignee_id is null or private.is_project_member(project_id, assignee_id)))
    or
    (not private.is_project_lead(project_id)
      and (assignee_id is null or assignee_id = (select auth.uid())))
  )
);

drop policy if exists project_tasks_update_assignee_or_lead on public.project_tasks;
create policy project_tasks_update_assignee_or_lead on public.project_tasks for update to authenticated
using (private.is_project_lead(project_id) or assignee_id = (select auth.uid()))
with check (
  (private.is_project_lead(project_id)
    and (assignee_id is null or private.is_project_member(project_id, assignee_id)))
  or
  (assignee_id = (select auth.uid()) and private.is_project_member(project_id, assignee_id))
);

drop policy if exists project_tasks_delete_lead on public.project_tasks;
create policy project_tasks_delete_lead on public.project_tasks for delete to authenticated
using (private.is_project_lead(project_id));

drop policy if exists project_activity_select_members on public.project_activity;
create policy project_activity_select_members on public.project_activity for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists project_activity_insert_members on public.project_activity;
create policy project_activity_insert_members on public.project_activity for insert to authenticated
with check (private.is_project_member(project_id) and actor_id = (select auth.uid()));

drop policy if exists project_attachments_select_members on public.project_attachments;
create policy project_attachments_select_members on public.project_attachments for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists project_attachments_insert_members on public.project_attachments;
create policy project_attachments_insert_members on public.project_attachments for insert to authenticated
with check (private.is_project_member(project_id) and uploaded_by = (select auth.uid()));

drop policy if exists project_attachments_delete_uploader_or_lead on public.project_attachments;
create policy project_attachments_delete_uploader_or_lead on public.project_attachments for delete to authenticated
using (uploaded_by = (select auth.uid()) or private.is_project_lead(project_id));
