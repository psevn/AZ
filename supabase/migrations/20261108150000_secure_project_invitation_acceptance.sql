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
