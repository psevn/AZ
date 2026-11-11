-- Minimal Supabase-compatible PostgreSQL fixture for the completion RPC.
-- Runs only in an isolated CI database; it does not connect to the AZ project.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (id uuid primary key);

create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

grant usage on schema auth to public;
grant execute on function auth.uid() to public;
grant usage on schema public to anon, authenticated;

create table public.documents (
  id uuid primary key,
  user_id uuid not null,
  status text not null,
  unique (id, user_id)
);

create table public.quizzes (
  id uuid primary key,
  user_id uuid not null,
  document_id uuid not null,
  unique (id, user_id),
  foreign key (document_id, user_id)
    references public.documents(id, user_id) on delete cascade
);

create table public.quiz_attempts (
  id uuid primary key,
  user_id uuid not null,
  quiz_id uuid not null,
  score numeric,
  started_at timestamptz not null,
  finished_at timestamptz,
  mode text not null,
  unique (id, user_id),
  foreign key (quiz_id, user_id)
    references public.quizzes(id, user_id) on delete cascade
);

create table public.attempt_questions (
  id uuid primary key,
  attempt_id uuid not null,
  user_id uuid not null,
  foreign key (attempt_id, user_id)
    references public.quiz_attempts(id, user_id) on delete cascade
);
