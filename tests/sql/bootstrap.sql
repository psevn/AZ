-- Minimal isolated Supabase-compatible baseline for migration tests.
-- This is disposable CI data; it never connects to the hosted AZ project.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint subjects_id_user_id_key unique (id, user_id)
);

alter table public.subjects enable row level security;
create policy subjects_own
  on public.subjects for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
