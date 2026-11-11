-- LOCAL TEST ONLY. Never applied to the real Supabase project.
-- Minimal Supabase-compatible objects for replaying migrations in disposable PostgreSQL.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb
);
create function auth.uid()
returns uuid language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text)
returns text[] language plpgsql immutable
as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

create schema private;
create schema cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text not null,
  schedule text not null,
  command text not null
);
create function cron.unschedule(p_jobid bigint)
returns boolean language plpgsql
as $$
declare n integer;
begin
  delete from cron.job where jobid = p_jobid;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
create function cron.schedule(p_jobname text, p_schedule text, p_command text)
returns bigint language plpgsql
as $$
declare v_jobid bigint;
begin
  insert into cron.job(jobname, schedule, command)
  values (p_jobname, p_schedule, p_command)
  returning jobid into v_jobid;
  return v_jobid;
end;
$$;

grant usage on schema public, auth, storage, private, cron to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant execute on function cron.unschedule(bigint), cron.schedule(text,text,text) to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  grant execute on functions to anon, authenticated, service_role;
