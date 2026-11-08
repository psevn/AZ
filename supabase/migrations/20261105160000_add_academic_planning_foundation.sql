-- AZ Planning foundation: academic terms, recurring class meetings,
-- and resumable academic setup state.
-- Additive only: preserves existing subjects, tasks, documents, and focus history.

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  start_date date,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_terms_date_order_chk
    check (start_date is null or end_date is null or end_date >= start_date),
  constraint academic_terms_id_user_id_key unique (id, user_id)
);

create unique index if not exists academic_terms_one_active_per_user_idx
  on public.academic_terms(user_id)
  where is_active = true;

create index if not exists academic_terms_user_created_idx
  on public.academic_terms(user_id, created_at desc);

alter table public.subjects
  add column if not exists term_id uuid,
  add column if not exists course_code text,
  add column if not exists instructor text,
  add column if not exists description text,
  add column if not exists archived_at timestamptz;

-- Owner-aware relation: a subject can only reference a term owned by the same user.
alter table public.subjects
  add constraint subjects_term_id_user_id_fkey
  foreign key (term_id, user_id)
  references public.academic_terms(id, user_id)
  on delete set null (term_id);

create index if not exists subjects_term_user_idx
  on public.subjects(term_id, user_id)
  where term_id is not null;

create index if not exists subjects_active_user_idx
  on public.subjects(user_id, created_at desc)
  where archived_at is null;

create table if not exists public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at_local time without time zone not null,
  ends_at_local time without time zone not null,
  timezone text not null,
  location text,
  meeting_type text not null default 'lecture'
    check (meeting_type in ('lecture', 'lab', 'tutorial', 'other')),
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  constraint class_meetings_time_order_chk
    check (ends_at_local > starts_at_local),
  constraint class_meetings_date_order_chk
    check (valid_from is null or valid_until is null or valid_until >= valid_from),
  constraint class_meetings_subject_user_fkey
    foreign key (subject_id, user_id)
    references public.subjects(id, user_id)
    on delete cascade
);

create index if not exists class_meetings_user_weekday_time_idx
  on public.class_meetings(user_id, weekday, starts_at_local);

create index if not exists class_meetings_subject_user_idx
  on public.class_meetings(subject_id, user_id);

create table if not exists public.academic_setup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'skipped', 'completed')),
  current_step text
    check (current_step is null or current_step in ('term', 'subjects', 'timetable', 'review')),
  timezone text,
  completed_at timestamptz,
  skipped_at timestamptz,
  updated_at timestamptz not null default now()
);

-- RLS: all rows are private to their owning authenticated user.
alter table public.academic_terms enable row level security;
alter table public.class_meetings enable row level security;
alter table public.academic_setup enable row level security;

drop policy if exists academic_terms_owner_all on public.academic_terms;
create policy academic_terms_owner_all
  on public.academic_terms for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists class_meetings_owner_all on public.class_meetings;
create policy class_meetings_owner_all
  on public.class_meetings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists academic_setup_owner_all on public.academic_setup;
create policy academic_setup_owner_all
  on public.academic_setup for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all privileges on table public.academic_terms from anon, authenticated;
revoke all privileges on table public.class_meetings from anon, authenticated;
revoke all privileges on table public.academic_setup from anon, authenticated;

grant select, insert, update, delete on table public.academic_terms to authenticated;
grant select, insert, update, delete on table public.class_meetings to authenticated;
grant select, insert, update, delete on table public.academic_setup to authenticated;
