-- Prevent browser clients from deleting project membership rows directly.
-- The trusted two-phase revocation RPCs are defined in the following migration.

drop policy if exists project_members_delete_lead on public.project_members;
revoke delete on table public.project_members from authenticated;
