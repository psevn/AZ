-- LOCAL TEST ONLY. Runs after the clean migration replay on disposable PostgreSQL.
-- Verifies representative tenant-isolation and least-privilege guarantees under
-- the authenticated role. Never run against a live Supabase database.

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-b@example.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'rls-c@example.invalid');

insert into public.subjects (id, user_id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A subject'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B subject');

insert into public.tasks (id, user_id, subject_id, title) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001', 'A task'),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1000000-0000-4000-8000-000000000001', 'B task');

insert into public.projects (id, created_by, title, due_at) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A project', now() + interval '1 day'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B project', now() + interval '1 day');

insert into public.project_members (project_id, user_id, role) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lead'),
  ('a3000000-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'member'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'lead');

insert into public.project_tasks (id, project_id, title, assignee_id, created_by) values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'A task assigned to A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('c4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'A task assigned to C', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'B project task', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into storage.objects (bucket_id, name) values
  ('documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.pdf'),
  ('documents', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.pdf');

-- Test as student A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

do $$
declare
  v_storage_count integer;
  v_storage_rls boolean;
  v_bypass boolean;
  v_policy_count integer;
begin
  if current_user <> 'authenticated' or auth.uid() <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'Authenticated role/JWT context is incorrect: role %, uid %', current_user, auth.uid();
  end if;

  if (select count(*) from public.subjects) <> 1
     or (select count(*) from public.tasks) <> 1
     or (select count(*) from public.projects) <> 1
     or (select count(*) from public.project_tasks) <> 2 then
    raise exception 'Student A can see another tenant or cannot see their own project rows';
  end if;

  if (select count(*) from public.planning_items where item_type = 'personal_task') <> 1
     or (select count(*) from public.planning_items where item_type = 'project_task') <> 1
     or (select count(*) from public.planning_items where item_type = 'project_deadline') <> 1 then
    raise exception 'Unified planning view does not respect the current user assignment/membership';
  end if;

  select relrowsecurity into v_storage_rls from pg_class where oid = 'storage.objects'::regclass;
  select rolbypassrls into v_bypass from pg_roles where rolname = current_user;
  select count(*) into v_policy_count from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and 'authenticated' = any(roles);
  select count(*) into v_storage_count from storage.objects;

  if v_storage_count <> 1 then
    raise exception 'Storage RLS diagnostic: visible %, uid %, RLS %, BYPASSRLS %, authenticated policies %',
      v_storage_count, auth.uid(), v_storage_rls, v_bypass, v_policy_count;
  end if;

  if has_table_privilege(current_user, 'public.documents', 'INSERT')
     or has_table_privilege(current_user, 'public.quizzes', 'INSERT')
     or has_table_privilege(current_user, 'public.quiz_questions', 'INSERT')
     or has_table_privilege(current_user, 'public.quiz_attempts', 'INSERT')
     or has_table_privilege(current_user, 'private.question_keys', 'SELECT') then
    raise exception 'A server-managed table or private answer key has an unexpected client grant';
  end if;

  begin
    insert into public.subjects (user_id, name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cross-tenant insert');
    raise exception 'Cross-tenant subject insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.projects (created_by, title)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cross-tenant project');
    raise exception 'Cross-tenant project insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.project_tasks (project_id, title, created_by)
    values ('b3000000-0000-4000-8000-000000000001', 'cross-project task', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'Non-member project task insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('documents', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/intrusion.pdf');
    raise exception 'Cross-tenant storage insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Student B must not see or mutate project A.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
do $$
begin
  if (select count(*) from public.projects where id = 'a3000000-0000-4000-8000-000000000001') <> 0
     or (select count(*) from public.project_tasks where project_id = 'a3000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'Non-member can read another team project';
  end if;

  begin
    update public.project_tasks set status = 'done'
     where id = 'a4000000-0000-4000-8000-000000000001';
    if found then raise exception 'Non-member unexpectedly updated another project task'; end if;
  end;
end
$$;

-- Student C is a project member, but not a lead: they may update their assigned task
-- without gaining lead-only assignment or project-management powers.
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
do $$
begin
  if (select count(*) from public.projects where id = 'a3000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from public.project_tasks where project_id = 'a3000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'Project member cannot read their own team data';
  end if;

  update public.project_tasks set status = 'done'
   where id = 'c4000000-0000-4000-8000-000000000001' and assignee_id = auth.uid();
  if not found then raise exception 'Assigned member could not update their task'; end if;

  begin
    update public.project_tasks set assignee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     where id = 'c4000000-0000-4000-8000-000000000001';
    if found then raise exception 'Non-lead member unexpectedly reassigned a project task'; end if;
  end;

  begin
    update public.projects set title = 'Member changed project title'
     where id = 'a3000000-0000-4000-8000-000000000001';
    if found then raise exception 'Non-lead member unexpectedly changed project settings'; end if;
  end;
end
$$;

-- Student A is the lead and may create a project through the granted RPC.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
declare
  v_project_id uuid;
begin
  select public.create_project('RPC-created test project', null, null, null) into v_project_id;
  if v_project_id is null
     or not exists (select 1 from public.projects where id = v_project_id and created_by = auth.uid())
     or not exists (select 1 from public.project_members where project_id = v_project_id and user_id = auth.uid() and role = 'lead')
     or not exists (select 1 from public.project_documents where project_id = v_project_id and is_primary and created_by = auth.uid()) then
    raise exception 'create_project RPC did not atomically create project, lead membership, and primary document';
  end if;
end
$$;

rollback;

\echo 'PASS: authenticated tenant isolation, project membership permissions, and create_project RPC checks passed.'
