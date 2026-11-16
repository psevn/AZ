-- Keep membership changes on the invitation acceptance path.
-- A project lead must not be able to add arbitrary users or promote members
-- by writing project_members directly from an authenticated client.
--
-- create_project remains able to add its creator as the initial lead through
-- the narrowly-scoped creator-self policy. accept_project_invitation runs
-- through its service_role-only RPC and is unaffected.

drop policy if exists project_members_insert_lead_or_creator on public.project_members;

create policy project_members_insert_creator_self_lead
on public.project_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'lead'
  and private.is_project_creator(project_id)
);

-- Leadership transfer is not part of the approved V1 permission model.
-- No authenticated UPDATE policy is intentionally recreated here.
drop policy if exists project_members_update_lead on public.project_members;
