create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  language     text not null default 'ar' check (language in ('ar','en')),
  created_at   timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 120),
  color      text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  subject_id    uuid,
  title         text not null check (length(title) between 1 and 300),
  due_at        timestamptz,
  priority      smallint not null default 2 check (priority between 1 and 3),
  est_minutes   integer check (est_minutes is null or est_minutes > 0),
  status        text not null default 'todo' check (status in ('todo','doing','done')),
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table public.focus_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  check (ended_at is null or ended_at >= started_at),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject_id   uuid,
  title        text not null,
  storage_path text not null,
  status       text not null default 'uploaded' check (status in ('uploaded','processing','ready','failed')),
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  unique (storage_path),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid,
  body        text not null default '',
  updated_at  timestamptz not null default now(),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

create table public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid,
  mode        text not null default 'standard' check (mode in ('standard','professional')),
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

create table public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_id       uuid not null,
  prompt        text not null,
  choices       jsonb not null,
  correct_index smallint not null check (correct_index >= 0),
  explanation   text,
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);

create table public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  uuid not null,
  chosen_index smallint not null check (chosen_index >= 0),
  is_correct   boolean not null,
  created_at   timestamptz not null default now(),
  foreign key (question_id, user_id) references public.quiz_questions (id, user_id) on delete cascade
);

create table public.ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  feature       text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  created_at    timestamptz not null default now()
);

create index on public.tasks (user_id, status, due_at);
create index on public.focus_sessions (user_id, started_at desc);
create index on public.documents (user_id, created_at desc);
create index on public.quiz_questions (quiz_id);
create index on public.quiz_attempts (user_id, created_at desc);
create index on public.ai_usage_log (user_id, created_at desc);

alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.tasks          enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.documents      enable row level security;
alter table public.notes          enable row level security;
alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;
alter table public.ai_usage_log   enable row level security;

create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['subjects','tasks','focus_sessions','documents','notes','quizzes','quiz_questions','quiz_attempts']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
  end loop;
end $$;

create policy ai_usage_read_own on public.ai_usage_log for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.ai_usage_log from authenticated;
