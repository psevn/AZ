-- Secure, single-use project invitation acceptance.
-- Invitation tokens are generated and hashed by the project-invitations Edge Function.
-- Only service_role may execute this RPC; browser clients cannot choose an arbitrary user id.

create or replace function public.accept_project_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.project_invitations%rowtype;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'INVITATION_INVALID' using errcode = '22023';
  end if;

  select *
    into v_invitation
    from public.project_invitations
   where token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'INVITATION_INVALID' using errcode = 'P0001';
  end if;

  if v_invitation.accepted_at is not null then
    -- Make retries safe (React StrictMode, refresh, or a lost HTTP response):
    -- the same authenticated member may repeat acceptance without consuming
    -- the invitation a second time.
    if exists (
      select 1
        from public.project_members
       where project_id = v_invitation.project_id
         and user_id = p_user_id
    ) then
      return v_invitation.project_id;
    end if;
    raise exception 'INVITATION_ALREADY_USED' using errcode = 'P0001';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001';
  end if;

  if v_invitation.invited_email is not null
     and lower(v_invitation.invited_email) <> lower(coalesce(p_user_email, '')) then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.project_members (
    project_id,
    user_id,
    role,
    invited_by
  )
  values (
    v_invitation.project_id,
    p_user_id,
    'member',
    v_invitation.created_by
  )
  on conflict (project_id, user_id) do nothing;

  update public.project_invitations
     set accepted_at = now()
   where id = v_invitation.id;

  insert into public.project_activity (project_id, actor_id, event_type, payload)
  values (
    v_invitation.project_id,
    p_user_id,
    'member_joined',
    jsonb_build_object('user_id', p_user_id)
  );

  return v_invitation.project_id;
end;
$$;

revoke all on function public.accept_project_invitation(text, uuid, text) from public;
revoke all on function public.accept_project_invitation(text, uuid, text) from anon;
revoke all on function public.accept_project_invitation(text, uuid, text) from authenticated;
grant execute on function public.accept_project_invitation(text, uuid, text) to service_role;

-- Project records are private to authenticated members. Anonymous API access is not needed.
revoke all privileges on table
  public.projects,
  public.project_members,
  public.project_invitations,
  public.project_documents,
  public.project_tasks,
  public.project_activity,
  public.project_attachments
from anon;

grant select, insert, update, delete on table
  public.projects,
  public.project_members,
  public.project_documents,
  public.project_tasks,
  public.project_activity,
  public.project_attachments
to authenticated;

revoke all privileges on table public.project_invitations from authenticated;

-- Activity is an audit trail, not a client-writable feed. The task trigger
-- writes as its owner while preserving auth.uid() as the originating actor.
create or replace function private.record_project_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $activity$
begin
  if tg_op = 'INSERT' then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      'task_created',
      jsonb_build_object('task_id', new.id, 'title', new.title)
    );

    if new.assignee_id is not null then
      insert into public.project_activity (project_id, actor_id, event_type, payload)
      values (
        new.project_id,
        auth.uid(),
        'task_assigned',
        jsonb_build_object('task_id', new.id, 'assignee_id', new.assignee_id)
      );
    end if;

    return new;
  end if;

  if old.assignee_id is distinct from new.assignee_id then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      case when old.assignee_id is null then 'task_assigned' else 'task_reassigned' end,
      jsonb_build_object(
        'task_id', new.id,
        'previous_assignee_id', old.assignee_id,
        'assignee_id', new.assignee_id
      )
    );
  end if;

  if old.status is distinct from new.status then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      case when new.status = 'done' then 'task_completed' else 'task_status_changed' end,
      jsonb_build_object(
        'task_id', new.id,
        'title', new.title,
        'previous_status', old.status,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$activity$;

revoke all on function private.record_project_task_activity() from public;
revoke all on function private.record_project_task_activity() from anon;
revoke all on function private.record_project_task_activity() from authenticated;

drop policy if exists project_activity_insert_members on public.project_activity;
revoke insert, update, delete on table public.project_activity from authenticated;
grant select on table public.project_activity to authenticated;
