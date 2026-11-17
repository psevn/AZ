-- Two-phase revocation closes the ticket-issuance race during member removal.
-- Marking a membership revoked immediately removes it from all RLS membership helpers
-- and prevents the collaboration Worker from issuing any newer tickets.

alter table public.project_members
  add column if not exists revoked_at timestamptz;

create or replace function private.is_project_member(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.revoked_at is null
  );
$function$;

create or replace function private.is_project_lead(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.role = 'lead'
      and pm.revoked_at is null
  );
$function$;

revoke all on function private.is_project_member(uuid,uuid) from public, anon;
revoke all on function private.is_project_lead(uuid,uuid) from public, anon;
grant execute on function private.is_project_member(uuid,uuid) to authenticated;
grant execute on function private.is_project_lead(uuid,uuid) to authenticated;

create or replace function public.begin_project_member_removal(
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

  select p.created_by into v_project_creator
    from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select pm.role into v_actor_role
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_actor_user_id
     and pm.revoked_at is null
   for update;
  if v_actor_role is distinct from 'lead' then
    raise exception 'PROJECT_LEAD_REQUIRED' using errcode = 'P0001';
  end if;

  select pm.role into v_member_role
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_member_user_id
   for update;
  if v_member_role is distinct from 'member' or p_member_user_id = v_project_creator then
    raise exception 'PROJECT_MEMBER_NOT_REMOVABLE' using errcode = 'P0001';
  end if;

  update public.project_members
     set revoked_at = coalesce(revoked_at, now())
   where project_id = p_project_id
     and user_id = p_member_user_id;
end;
$$;

revoke all on function public.begin_project_member_removal(uuid, uuid, uuid) from public;
revoke all on function public.begin_project_member_removal(uuid, uuid, uuid) from anon;
revoke all on function public.begin_project_member_removal(uuid, uuid, uuid) from authenticated;
grant execute on function public.begin_project_member_removal(uuid, uuid, uuid) to service_role;

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
  v_revoked_at timestamptz;
begin
  select p.created_by into v_project_creator
    from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select pm.role into v_actor_role
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_actor_user_id
     and pm.revoked_at is null
   for update;
  if v_actor_role is distinct from 'lead' then
    raise exception 'PROJECT_LEAD_REQUIRED' using errcode = 'P0001';
  end if;

  select pm.role, pm.revoked_at
    into v_member_role, v_revoked_at
    from public.project_members pm
   where pm.project_id = p_project_id
     and pm.user_id = p_member_user_id
   for update;
  if v_member_role is distinct from 'member'
     or p_member_user_id = v_project_creator
     or v_revoked_at is null then
    raise exception 'PROJECT_MEMBER_NOT_READY_FOR_REMOVAL' using errcode = 'P0001';
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

-- A pending revocation must finish across every document before the user can
-- rejoin. Otherwise a fresh invitation could reactivate membership while a
-- document whose Worker acknowledgement failed still accepts the old socket.
-- Once removal is finalized, a fresh invitation inserts a new membership row.
create or replace function public.accept_project_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.project_invitations%rowtype;
  v_inserted integer;
  v_existing_revoked_at timestamptz;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'INVITATION_INVALID' using errcode = '22023';
  end if;

  select * into v_invitation
    from public.project_invitations
   where token_hash = p_token_hash
   for update;
  if not found then
    raise exception 'INVITATION_INVALID' using errcode = 'P0001';
  end if;

  if v_invitation.accepted_at is not null then
    if exists (
      select 1 from public.project_members
       where project_id = v_invitation.project_id
         and user_id = p_user_id
         and revoked_at is null
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

  insert into public.project_members (project_id, user_id, role, invited_by)
  values (v_invitation.project_id, p_user_id, 'member', v_invitation.created_by)
  on conflict (project_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select revoked_at into v_existing_revoked_at
      from public.project_members
     where project_id = v_invitation.project_id
       and user_id = p_user_id
     for update;
    if v_existing_revoked_at is not null then
      raise exception 'PROJECT_MEMBER_REVOCATION_PENDING' using errcode = 'P0001';
    end if;
    raise exception 'PROJECT_MEMBER_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

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
$function$;

revoke all on function public.accept_project_invitation(text, uuid, text) from public;
revoke all on function public.accept_project_invitation(text, uuid, text) from anon;
revoke all on function public.accept_project_invitation(text, uuid, text) from authenticated;
grant execute on function public.accept_project_invitation(text, uuid, text) to service_role;
