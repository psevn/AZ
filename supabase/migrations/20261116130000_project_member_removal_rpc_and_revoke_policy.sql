-- Route member removal through a trusted, atomic server-side operation.
-- The Edge Function revokes active document sessions before calling this RPC.

drop policy if exists project_members_delete_lead on public.project_members;
revoke delete on table public.project_members from authenticated;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_member_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_creator uuid;
  v_actor_role text;
  v_member_role text;
begin
  if p_project_id is null or p_member_user_id is null or p_actor_user_id is null then
    raise exception 'PROJECT_MEMBER_INVALID_INPUT' using errcode = '22023';
  end if;

  if p_member_user_id = p_actor_user_id then
    raise exception 'PROJECT_MEMBER_SELF_REMOVAL_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select p.created_by
    into v_project_creator
    from public.projects p
   where p.id = p_project_id
   for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select pm.role
    into v_actor_role
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_actor_user_id
   for update;

  if v_actor_role is distinct from 'lead' then
    raise exception 'PROJECT_LEAD_REQUIRED' using errcode = 'P0001';
  end if;

  select pm.role
    into v_member_role
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_member_user_id
   for update;

  if v_member_role is distinct from 'member' or p_member_user_id = v_project_creator then
    raise exception 'PROJECT_MEMBER_NOT_REMOVABLE' using errcode = 'P0001';
  end if;

  delete from public.project_members
   where project_id = p_project_id
     and user_id = p_member_user_id;

  if not found then
    raise exception 'PROJECT_MEMBER_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.project_activity (project_id, actor_id, event_type, payload)
  values (
    p_project_id,
    p_actor_user_id,
    'member_removed',
    jsonb_build_object('user_id', p_member_user_id)
  );
end;
$$;

revoke all on function public.remove_project_member(uuid, uuid, uuid) from public;
revoke all on function public.remove_project_member(uuid, uuid, uuid) from anon;
revoke all on function public.remove_project_member(uuid, uuid, uuid) from authenticated;
grant execute on function public.remove_project_member(uuid, uuid, uuid) to service_role;
