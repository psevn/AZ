-- M5 (audit fix of ChatGPT's az_projects migrations, applied live 2026-11-08).
-- Found by Claude (rolled-back runtime test on the live project):
--  1) public.create_project() failed with 42501 for EVERY real user. It did
--     "insert into projects ... returning id"; RETURNING requires the SELECT policy
--     (is_project_member), but the creator is only added to project_members AFTER the insert,
--     so the row was invisible to its own creator. Fix: generate the id first and insert without RETURNING.
--  2) The six project tables carried Supabase's default over-broad grants: anon had ALL privileges
--     (incl. TRUNCATE) and authenticated had TRUNCATE/TRIGGER/REFERENCES. RLS still blocked row access
--     (policies are authenticated-only) but TRUNCATE is not subject to RLS and the repo's rule is deny-first
--     with CRUD-only grants (see 20261104150300_limit_client_table_grants_to_crud.sql).
-- No behaviour change for legitimate use.

create or replace function public.create_project(
  p_title text,
  p_description text default null,
  p_subject_id uuid default null,
  p_due_at timestamptz default null)
 returns uuid
 language plpgsql
 set search_path to ''
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

  -- no RETURNING: the creator is not a member yet, so the SELECT policy would hide the new row
  insert into public.projects (id, created_by, subject_id, title, description, due_at)
  values (v_project_id, v_user_id, p_subject_id, btrim(p_title),
          nullif(btrim(coalesce(p_description, '')), ''), p_due_at);

  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, v_user_id, 'lead');

  return v_project_id;
end;
$function$;

revoke all on table public.projects, public.project_members, public.project_tasks,
  public.project_documents, public.project_activity, public.project_attachments from anon;
revoke truncate, trigger, references on table public.projects, public.project_members, public.project_tasks,
  public.project_documents, public.project_activity, public.project_attachments from authenticated;
