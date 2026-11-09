-- Recovered on 2026-11-09 by introspecting the live AZ Supabase schema.
-- This is a schema-equivalent reconstruction, not the original migration text.
-- Keep changes additive and review against the live schema before applying anywhere.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  subject_id uuid,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_check check (char_length(btrim(title)) between 1 and 180),
  constraint projects_description_check check (description is null or char_length(description) <= 10000),
  constraint projects_status_check check (status in ('active','completed','archived')),
  constraint projects_id_created_by_key unique (id, created_by),
  constraint projects_subject_owner_fkey foreign key (subject_id, created_by)
    references public.subjects(id, user_id)
);

comment on table public.projects is
  'Private academic team projects. Project due_at is the canonical deadline surfaced through planning_items for every member.';

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  constraint project_members_pkey primary key (project_id, user_id),
  constraint project_members_role_check check (role in ('lead','member'))
);

create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  invited_email text,
  role text not null default 'member',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint project_invitations_invited_email_check
    check (invited_email is null or char_length(invited_email) <= 320),
  constraint project_invitations_role_check check (role = 'member')
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Project report',
  document_type text not null default 'report',
  is_primary boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_documents_title_check check (char_length(btrim(title)) between 1 and 180),
  constraint project_documents_document_type_check check (document_type in ('report','notes','other'))
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz,
  priority smallint not null default 2,
  est_minutes integer,
  status text not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint project_tasks_title_check check (char_length(btrim(title)) between 1 and 300),
  constraint project_tasks_description_check check (description is null or char_length(description) <= 5000),
  constraint project_tasks_priority_check check (priority between 1 and 3),
  constraint project_tasks_est_minutes_check check (est_minutes is null or est_minutes > 0),
  constraint project_tasks_status_check check (status in ('todo','doing','done')),
  constraint project_tasks_assignee_member_fkey
    foreign key (project_id, assignee_id)
    references public.project_members(project_id, user_id)
    on delete set null (assignee_id)
);

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_activity_event_type_check check (event_type = any (array[
    'project_created','member_joined','member_removed','task_created',
    'task_assigned','task_reassigned','task_status_changed','task_completed',
    'document_created','document_edited','deadline_changed','project_completed',
    'project_archived','attachment_uploaded'
  ]::text[]),
  constraint project_activity_payload_check check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  created_at timestamptz not null default now(),
  constraint project_attachments_filename_check check (char_length(filename) between 1 and 255),
  constraint project_attachments_byte_size_check check (byte_size > 0)
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_activity enable row level security;
alter table public.project_attachments enable row level security;

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
    where pm.project_id = p_project_id and pm.user_id = p_user_id
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
    where pm.project_id = p_project_id and pm.user_id = p_user_id and pm.role = 'lead'
  );
$function$;

create or replace function private.is_project_creator(
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
    select 1 from public.projects p
    where p.id = p_project_id and p.created_by = p_user_id
  );
$function$;

revoke all on function private.is_project_member(uuid,uuid) from public, anon;
revoke all on function private.is_project_lead(uuid,uuid) from public, anon;
revoke all on function private.is_project_creator(uuid,uuid) from public, anon;
grant execute on function private.is_project_member(uuid,uuid) to authenticated;
grant execute on function private.is_project_lead(uuid,uuid) to authenticated;
grant execute on function private.is_project_creator(uuid,uuid) to authenticated;
