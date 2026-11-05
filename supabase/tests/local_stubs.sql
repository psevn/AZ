-- LOCAL TEST ONLY. Never applied to the real Supabase project.
-- Recreates the minimum of Supabase's environment so the live-schema snapshot
-- can be tested on a throwaway Postgres: roles, auth.users, auth.uid(),
-- storage.buckets/objects/foldername(), and Supabase's permissive default
-- privileges (so explicit REVOKEs in the snapshot are genuinely exercised).

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
returns uuid
language sql
stable
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
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

create function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
-- Supabase's storage grants: authenticated can reach storage.objects, RLS decides.
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- Supabase grants new public tables to these roles by default:
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
create schema private;
alter default privileges for role postgres in schema private
  grant all on tables to anon, authenticated, service_role;
-- Supabase also grants EXECUTE on new functions to these roles by default:
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  grant execute on functions to anon, authenticated, service_role;
