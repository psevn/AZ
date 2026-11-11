-- LOCAL TEST ONLY. Runs after the clean migration replay on disposable PostgreSQL.
-- Verifies representative tenant-isolation and least-privilege guarantees under
-- the authenticated role. Never run against a live Supabase database.

begin;

-- Stable fixtures make failures reproducible and keep the test independent of auth services.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-b@example.invalid');

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
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'lead');

insert into public.project_tasks (id, project_id, title, assignee_id, created_by) values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'A project task', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'B project task', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
insert into storage.objects (bucket_id, name) values
  ('documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.pdf'),
  ('documents', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

do $$
begin
  if current_user <> 'authenticated' then
    raise exception 'RLS test is not running as authenticated';
  end if;

  if (select count(*) from public.subjects) <> 1
     or (select count(*) from public.tasks) <> 1
     or (select count(*) from public.projects) <> 1
     or (select count(*) from public.project_tasks) <> 1 then
    raise exception 'Authenticated user can see another user\'s personal or project rows';
  end if;

  if (select count(*) from public.planning_items where item_type = 'personal_task') <> 1
     or (select count(*) from public.planning_items where item_type = 'project_task') <> 1
     or (select count(*) from public.planning_items where item_type = 'project_deadline') <> 1 then
    raise exception 'Unified planning view does not respect the current user\'s ownership/membership';
  end if;

  if (select count(*) from storage.objects) <> 1 then
    raise exception 'Storage document policy exposed another user\'s object';
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
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.projects (created_by, title)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cross-tenant project');
    raise exception 'Cross-tenant project insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.project_tasks (project_id, title, created_by)
    values (
      'b3000000-0000-4000-8000-000000000001',
      'cross-project task',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    raise exception 'Non-member project task insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('documents', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/intrusion.pdf');
    raise exception 'Cross-tenant storage insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

rollback;

\echo 'PASS: representative authenticated RLS isolation and least-privilege checks passed.'
