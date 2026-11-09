-- Recovered on 2026-11-09 from the current live function definition and grants.
-- This is a schema-equivalent reconstruction, not the original migration text.
-- Pre-generate the UUID: INSERT ... RETURNING would require SELECT visibility
-- before the creator's project_members row exists, which conflicts with member-only SELECT RLS.

create or replace function public.create_project(
  p_title text,
  p_description text default null,
  p_subject_id uuid default null,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_title is null or char_length(btrim(p_title)) < 1 or char_length(btrim(p_title)) > 180 then
    raise exception 'Project title must be between 1 and 180 characters' using errcode = '22023';
  end if;

  insert into public.projects (
    id,
    created_by,
    subject_id,
    title,
    description,
    due_at
  )
  values (
    v_project_id,
    v_user_id,
    p_subject_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_due_at
  );

  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, v_user_id, 'lead');

  return v_project_id;
end;
$function$;

revoke all on function public.create_project(text,text,uuid,timestamptz) from public, anon;
grant execute on function public.create_project(text,text,uuid,timestamptz) to authenticated;

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
