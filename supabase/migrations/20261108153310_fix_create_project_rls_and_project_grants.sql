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
