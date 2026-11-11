
drop policy if exists projects_update_lead on public.projects;
create policy projects_update_lead on public.projects
  for update to authenticated using (private.is_project_lead(id))
  with check (private.is_project_lead(id));

drop policy if exists projects_delete_lead on public.projects;
create policy projects_delete_lead on public.projects
  for delete to authenticated using (private.is_project_lead(id));

drop policy if exists project_tasks_insert_members on public.project_tasks;
create policy project_tasks_insert_members on public.project_tasks
  for insert to authenticated with check (
    private.is_project_member(project_id)
    and created_by = (select auth.uid())
    and (
      (private.is_project_lead(project_id) and
        (assignee_id is null or private.is_project_member(project_id, assignee_id)))
      or
      (not private.is_project_lead(project_id) and
        (assignee_id is null or assignee_id = (select auth.uid())))
    )
  );

drop policy if exists project_invitations_no_client_access on public.project_invitations;
create policy project_invitations_no_client_access on public.project_invitations
  for all to authenticated using (false) with check (false);

create index if not exists projects_subject_owner_idx on public.projects(subject_id, created_by);
create index if not exists project_members_invited_by_idx on public.project_members(invited_by);
create index if not exists project_tasks_project_assignee_idx on public.project_tasks(project_id, assignee_id);
create index if not exists project_tasks_created_by_idx on public.project_tasks(created_by);
create index if not exists project_activity_actor_idx on public.project_activity(actor_id);
create index if not exists project_documents_created_by_idx on public.project_documents(created_by);
create index if not exists project_invitations_created_by_idx on public.project_invitations(created_by);
create index if not exists project_attachments_project_idx on public.project_attachments(project_id);
create index if not exists project_attachments_uploaded_by_idx on public.project_attachments(uploaded_by);
