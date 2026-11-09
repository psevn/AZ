-- Recovered on 2026-11-09 from current live grants and function ACLs.
-- This is a schema-equivalent reconstruction, not the original migration text.
-- Project tables are accessible only to authenticated members through RLS.
-- Invitations remain server-only; their tokens must never be readable by clients.

revoke all on table public.projects from anon;
revoke all on table public.project_members from anon;
revoke all on table public.project_invitations from anon, authenticated;
revoke all on table public.project_documents from anon;
revoke all on table public.project_tasks from anon;
revoke all on table public.project_activity from anon;
revoke all on table public.project_attachments from anon;

grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_members to authenticated;
grant select, insert, update, delete on table public.project_documents to authenticated;
grant select, insert, update, delete on table public.project_tasks to authenticated;
grant select, insert, update, delete on table public.project_activity to authenticated;
grant select, insert, update, delete on table public.project_attachments to authenticated;

revoke all on function public.create_project(text,text,uuid,timestamptz) from public, anon;
grant execute on function public.create_project(text,text,uuid,timestamptz) to authenticated;
