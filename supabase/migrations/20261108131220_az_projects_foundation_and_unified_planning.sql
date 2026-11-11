
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  subject_id uuid null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text null check (description is null or char_length(description) <= 10000),
  due_at timestamptz null,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, created_by),
  constraint projects_subject_owner_fkey
    foreign key (subject_id, created_by) references public.subjects(id, user_id)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member')),
  joined_at timestamptz not null default now(),
  invited_by uuid null references auth.users(id) on delete set null,
  primary key (project_id, user_id)
);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  invited_email text null,
  role text not null default 'member' check (role = 'member'),
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invited_email is null or char_length(invited_email) <= 320)
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Project report' check (char_length(btrim(title)) between 1 and 180),
  document_type text not null default 'report' check (document_type in ('report','notes','other')),
  is_primary boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index project_documents_one_primary_idx
  on public.project_documents(project_id) where is_primary;

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text null check (description is null or char_length(description) <= 5000),
  assignee_id uuid null,
  created_by uuid not null references auth.users(id),
  due_at timestamptz null,
  priority smallint not null default 2 check (priority between 1 and 3),
  est_minutes integer null check (est_minutes is null or est_minutes > 0),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint project_tasks_assignee_member_fkey
    foreign key (project_id, assignee_id)
    references public.project_members(project_id, user_id)
    on delete set null (assignee_id)
);

create table public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'project_created','member_joined','member_removed','task_created',
    'task_assigned','task_reassigned','task_status_changed','task_completed',
    'document_created','document_edited','deadline_changed',
    'project_completed','project_archived','attachment_uploaded'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now()
);

create index project_members_user_project_idx on public.project_members(user_id, project_id);
create index projects_created_by_idx on public.projects(created_by);
create index projects_due_at_idx on public.projects(due_at) where due_at is not null;
create index project_tasks_assignee_due_idx on public.project_tasks(assignee_id, due_at) where due_at is not null;
create index project_tasks_project_status_idx on public.project_tasks(project_id, status);
create index project_activity_project_created_idx on public.project_activity(project_id, created_at desc);
create index project_invitations_project_expiry_idx on public.project_invitations(project_id, expires_at);

create or replace function private.is_project_member(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = p_user_id
  );
$$;

create or replace function private.is_project_lead(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = p_user_id and pm.role = 'lead'
  );
$$;

create or replace function private.is_project_creator(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.created_by = p_user_id
  );
$$;

revoke all on function private.is_project_member(uuid, uuid) from public, anon;
revoke all on function private.is_project_lead(uuid, uuid) from public, anon;
revoke all on function private.is_project_creator(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_project_member(uuid, uuid) to authenticated;
grant execute on function private.is_project_lead(uuid, uuid) to authenticated;
grant execute on function private.is_project_creator(uuid, uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_activity enable row level security;
alter table public.project_attachments enable row level security;

create policy projects_select_members on public.projects
  for select to authenticated using (private.is_project_member(id));
create policy projects_insert_creator on public.projects
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy projects_update_lead on public.projects
  for update to authenticated using (private.is_project_lead(id))
  with check (private.is_project_lead(id) and created_by = (select auth.uid()));
create policy projects_delete_lead on public.projects
  for delete to authenticated using (private.is_project_lead(id) and created_by = (select auth.uid()));

create policy project_members_select_team on public.project_members
  for select to authenticated using (private.is_project_member(project_id));
create policy project_members_insert_lead_or_creator on public.project_members
  for insert to authenticated with check (
    (user_id = (select auth.uid()) and role = 'lead' and private.is_project_creator(project_id))
    or private.is_project_lead(project_id)
  );
create policy project_members_update_lead on public.project_members
  for update to authenticated using (private.is_project_lead(project_id))
  with check (private.is_project_lead(project_id));
create policy project_members_delete_lead on public.project_members
  for delete to authenticated using (private.is_project_lead(project_id) and user_id <> (select auth.uid()));

create policy project_documents_select_members on public.project_documents
  for select to authenticated using (private.is_project_member(project_id));
create policy project_documents_insert_members on public.project_documents
  for insert to authenticated with check (private.is_project_member(project_id) and created_by = (select auth.uid()));
create policy project_documents_update_lead on public.project_documents
  for update to authenticated using (private.is_project_lead(project_id))
  with check (private.is_project_lead(project_id));
create policy project_documents_delete_lead on public.project_documents
  for delete to authenticated using (private.is_project_lead(project_id));

create policy project_tasks_select_members on public.project_tasks
  for select to authenticated using (private.is_project_member(project_id));
create policy project_tasks_insert_members on public.project_tasks
  for insert to authenticated with check (
    private.is_project_member(project_id)
    and created_by = (select auth.uid())
    and (assignee_id is null or private.is_project_member(project_id, assignee_id))
  );
create policy project_tasks_update_assignee_or_lead on public.project_tasks
  for update to authenticated
  using (private.is_project_lead(project_id) or assignee_id = (select auth.uid()))
  with check (
    private.is_project_lead(project_id)
    and (assignee_id is null or private.is_project_member(project_id, assignee_id))
    or (
      assignee_id = (select auth.uid())
      and private.is_project_member(project_id, assignee_id)
    )
  );
create policy project_tasks_delete_lead on public.project_tasks
  for delete to authenticated using (private.is_project_lead(project_id));

create policy project_activity_select_members on public.project_activity
  for select to authenticated using (private.is_project_member(project_id));
create policy project_activity_insert_members on public.project_activity
  for insert to authenticated with check (
    private.is_project_member(project_id)
    and actor_id = (select auth.uid())
  );

create policy project_attachments_select_members on public.project_attachments
  for select to authenticated using (private.is_project_member(project_id));
create policy project_attachments_insert_members on public.project_attachments
  for insert to authenticated with check (
    private.is_project_member(project_id) and uploaded_by = (select auth.uid())
  );
create policy project_attachments_delete_uploader_or_lead on public.project_attachments
  for delete to authenticated using (
    uploaded_by = (select auth.uid()) or private.is_project_lead(project_id)
  );

revoke all on public.project_invitations from anon, authenticated;
grant select, insert, update, delete on public.projects,
  public.project_members, public.project_documents, public.project_tasks,
  public.project_activity, public.project_attachments to authenticated;
grant select on public.projects, public.project_members, public.project_documents,
  public.project_tasks, public.project_activity, public.project_attachments to service_role;
grant select, insert, update, delete on public.project_invitations to service_role;

create or replace view public.planning_items
with (security_invoker = true)
as
  select
    t.id,
    'personal_task'::text as item_type,
    t.title,
    t.due_at,
    t.status,
    t.priority,
    t.est_minutes,
    t.subject_id,
    null::uuid as project_id,
    null::text as project_title
  from public.tasks t
  where t.user_id = (select auth.uid())

  union all

  select
    pt.id,
    'project_task'::text as item_type,
    pt.title,
    pt.due_at,
    pt.status,
    pt.priority,
    pt.est_minutes,
    null::uuid as subject_id,
    p.id as project_id,
    p.title as project_title
  from public.project_tasks pt
  join public.projects p on p.id = pt.project_id
  where pt.assignee_id = (select auth.uid())

  union all

  select
    p.id,
    'project_deadline'::text as item_type,
    p.title || ' — Project deadline' as title,
    p.due_at,
    case when p.status = 'completed' then 'done' else 'todo' end as status,
    1::smallint as priority,
    null::integer as est_minutes,
    null::uuid as subject_id,
    p.id as project_id,
    p.title as project_title
  from public.projects p
  where p.due_at is not null
    and private.is_project_member(p.id)
    and p.status <> 'archived';

grant select on public.planning_items to authenticated;

comment on table public.projects is 'Private academic team projects. Project due_at is the canonical deadline surfaced through planning_items for every member.';
comment on view public.planning_items is 'Unified personal and project planning feed. Project deadlines are derived from projects.due_at, never duplicated into personal tasks.';
