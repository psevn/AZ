-- Isolated PostgreSQL contract test for the recovered AZ Projects migrations.
-- Runs only against the disposable CI Postgres service, never the connected AZ DB.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique
);
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.subjects (
  id uuid not null,
  user_id uuid not null,
  primary key (id, user_id),
  unique (id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  due_at timestamptz,
  status text not null default 'todo',
  priority smallint not null default 2,
  est_minutes integer,
  subject_id uuid
);

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-000000000001','lead@example.test'),
  ('00000000-0000-0000-0000-000000000002','member@example.test'),
  ('00000000-0000-0000-0000-000000000003','outsider@example.test');

\ir ../migrations/20261108131220_az_projects_foundation_and_unified_planning.sql
\ir ../migrations/20261108131237_az_projects_policy_and_index_hardening.sql
\ir ../migrations/20261108131303_az_projects_planning_deadline_title.sql
\ir ../migrations/20261108133920_create_primary_project_document_on_lead_membership.sql
\ir ../migrations/20261108134005_add_atomic_create_project_rpc.sql
\ir ../migrations/20261108134104_record_project_task_activity.sql
\ir ../migrations/20261108153310_fix_create_project_rls_and_project_grants.sql
\ir ../migrations/20261108150000_secure_project_invitation_acceptance.sql
\ir ../migrations/20261116120000_harden_project_membership_mutations.sql
\ir ../migrations/20261116130000_project_member_removal_rpc_and_revoke_policy.sql

-- A signed-in lead can create a project and gets a primary shared document.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.create_project('CI collaboration project','migration contract test',null,null);
commit;

do $$
begin
  if not exists (
    select 1 from public.projects p
    join public.project_members pm on pm.project_id = p.id
    where p.title = 'CI collaboration project'
      and pm.user_id = '00000000-0000-0000-0000-000000000001'
      and pm.role = 'lead'
  ) then
    raise exception 'Project creation or lead membership failed';
  end if;

  if not exists (
    select 1 from public.project_documents d
    join public.projects p on p.id = d.project_id
    where p.title = 'CI collaboration project' and d.is_primary
  ) then
    raise exception 'Primary project document trigger failed';
  end if;
end;
$$;

-- The lead can create a task; the security-definer trigger records activity.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.project_tasks (project_id,title,created_by,assignee_id)
select id,'Write project introduction',
       '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001'
from public.projects where title = 'CI collaboration project';
commit;

do $$
begin
  if not exists (
    select 1 from public.project_activity a
    join public.projects p on p.id = a.project_id
    where p.title = 'CI collaboration project' and a.event_type = 'task_created'
  ) then
    raise exception 'Task activity trigger failed';
  end if;

  if has_table_privilege('authenticated','public.project_activity','INSERT') then
    raise exception 'Authenticated users must not be able to forge activity rows';
  end if;

  if has_table_privilege('authenticated','public.project_invitations','SELECT') then
    raise exception 'Authenticated users must not be able to read invitation tokens';
  end if;
end;
$$;

-- Service-role-only invitation acceptance is email-bound and adds the member.
select id as ci_project_id from public.projects
where title = 'CI collaboration project' \gset

grant all on table public.project_invitations to service_role;
begin;
set local role service_role;
insert into public.project_invitations (
  project_id,token_hash,invited_email,expires_at,created_by
)
values (
  :'ci_project_id'::uuid,
  repeat('a',64),
  'member@example.test',
  now() + interval '1 day',
  '00000000-0000-0000-0000-000000000001'
);
select public.accept_project_invitation(
  repeat('a',64),
  '00000000-0000-0000-0000-000000000002',
  'member@example.test'
);
commit;

do $$
begin
  if not exists (
    select 1 from public.project_members pm
    join public.projects p on p.id = pm.project_id
    where p.title = 'CI collaboration project'
      and pm.user_id = '00000000-0000-0000-0000-000000000002'
      and pm.role = 'member'
  ) then
    raise exception 'Invitation acceptance failed to add member';
  end if;

  if not exists (
    select 1 from public.project_activity a
    join public.projects p on p.id = a.project_id
    where p.title = 'CI collaboration project' and a.event_type = 'member_joined'
  ) then
    raise exception 'Invitation acceptance did not write member_joined audit event';
  end if;
end;
$$;

-- A project lead must not bypass email-bound invitations by inserting a
-- membership directly or promoting an existing member to lead.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $membership_guard$
declare
  affected integer;
begin
  begin
    insert into public.project_members (project_id,user_id,role,invited_by)
    select id,'00000000-0000-0000-0000-000000000003','member',
           '00000000-0000-0000-0000-000000000001'
    from public.projects where title = 'CI collaboration project';
    raise exception 'Lead unexpectedly inserted a member without invitation';
  exception
    when insufficient_privilege then null;
  end;

  update public.project_members
     set role = 'lead'
   where project_id = (
     select id from public.projects where title = 'CI collaboration project'
   )
     and user_id = '00000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Lead unexpectedly promoted a member through direct UPDATE';
  end if;
end;
$membership_guard$;
commit;

-- Membership removal is service-role-only and records an audit event atomically.
do $
begin
  if has_table_privilege('authenticated','public.project_members','DELETE') then
    raise exception 'Authenticated users must not directly delete project memberships';
  end if;
end;
$;

begin;
set local role service_role;
select public.remove_project_member(
  :'ci_project_id'::uuid,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
);
commit;

do $
begin
  if exists (
    select 1 from public.project_members
    where project_id = :'ci_project_id'::uuid
      and user_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Service-role member removal did not delete membership';
  end if;
  if not exists (
    select 1 from public.project_activity
    where project_id = :'ci_project_id'::uuid
      and event_type = 'member_removed'
      and payload->>'user_id' = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Member removal did not write the member_removed audit event';
  end if;
end;
$;

-- RLS must hide the project from a non-member.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $rls_check$
begin
  if exists (select 1 from public.projects where title = 'CI collaboration project') then
    raise exception 'RLS leaked a project to a non-member';
  end if;
end;
$rls_check$;
commit;

select 'AZ Projects migration contract passed' as result;
