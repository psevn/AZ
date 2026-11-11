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

insert into public.documents (id, user_id, title, storage_path, status) values
  ('d1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A study pack', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.pdf', 'ready'),
  ('d2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B study pack', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.pdf', 'ready');

insert into public.quizzes (id, user_id, document_id, mode) values
  ('e1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd1000000-0000-4000-8000-000000000001', 'standard'),
  ('e2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'd2000000-0000-4000-8000-000000000001', 'standard');

insert into public.quiz_questions (id, user_id, quiz_id, prompt, choices) values
  ('f1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001', 'A question 1', '["correct","wrong"]'::jsonb),
  ('f1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001', 'A question 2', '["correct","wrong"]'::jsonb),
  ('f1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001', 'A question 3', '["correct","wrong"]'::jsonb),
  ('f1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001', 'A question 4', '["correct","wrong"]'::jsonb),
  ('f1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001', 'A question 5', '["correct","wrong"]'::jsonb),
  ('f2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'e2000000-0000-4000-8000-000000000001', 'B question', '["correct","wrong"]'::jsonb);

insert into private.question_keys (question_id, user_id, correct_index, explanation) values
  ('f1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'A explanation 1'),
  ('f1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'A explanation 2'),
  ('f1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'A explanation 3'),
  ('f1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'A explanation 4'),
  ('f1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'A explanation 5'),
  ('f2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 0, 'B explanation');

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

  -- Migration 20261105122212 deliberately drops all client Storage policies.
  -- In this design the browser has no direct Storage access; trusted server code owns it.
  if v_storage_count <> 0 or v_storage_rls is not true or v_bypass is not false or v_policy_count <> 0 then
    raise exception 'Expected locked client Storage: visible %, uid %, RLS %, BYPASSRLS %, authenticated policies %',
      v_storage_count, auth.uid(), v_storage_rls, v_bypass, v_policy_count;
  end if;

  if not has_function_privilege('authenticated', to_regprocedure('public.create_project(text,text,uuid,timestamptz)'), 'EXECUTE')
     or has_function_privilege('anon', to_regprocedure('public.create_project(text,text,uuid,timestamptz)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.start_attempt(uuid,text,integer,integer)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.submit_answer(uuid,uuid,smallint)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.finish_attempt(uuid)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.complete_daily_challenge(text,date,uuid,uuid,uuid)'), 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure('public.reserve_credits(uuid,text,text,numeric)'), 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure('public.settle_credits(uuid,text,text,numeric,text,text,text,integer,text)'), 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure('public.refund_credits(uuid,text,text,text)'), 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure('public.sweep_stuck_reservations(integer)'), 'EXECUTE') then
    raise exception 'A sensitive RPC has an unexpected execute grant';
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
    values ('documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/intrusion.pdf');
    raise exception 'Authenticated client unexpectedly wrote to locked Storage';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Exercise the real practice/grading and Daily Challenge RPC chain as student A.
do $
declare
  v_attempt_id uuid;
  v_question_id uuid;
  v_correct_index smallint;
  v_is_correct boolean;
  v_explanation text;
  v_challenge_date date := (now() at time zone 'Asia/Qatar')::date;
  v_challenge_id text;
  v_completion_id uuid;
  v_already_completed boolean;
  r record;
begin
  select attempt_id into v_attempt_id
    from public.start_attempt('e1000000-0000-4000-8000-000000000001', 'practice', 5, null);
  perform set_config('test.daily_attempt_id', v_attempt_id::text, true);

  for r in
    select question_id from public.attempt_questions
     where attempt_id = v_attempt_id order by position_no
  loop
    select correct_index, is_correct, explanation
      into v_correct_index, v_is_correct, v_explanation
      from public.submit_answer(v_attempt_id, r.question_id, 0);
    if v_correct_index <> 0 or v_is_correct is not true or v_explanation is null then
      raise exception 'Practice grading RPC returned an unexpected result';
    end if;
  end loop;

  perform * from public.finish_attempt(v_attempt_id);

  v_challenge_id := to_char(v_challenge_date, 'YYYY-MM-DD')
    || ':practice_study_pack:d1000000-0000-4000-8000-000000000001:e1000000-0000-4000-8000-000000000001';

  select completion_id, already_completed into v_completion_id, v_already_completed
    from public.complete_daily_challenge(
      v_challenge_id,
      v_challenge_date,
      'd1000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      v_attempt_id
    );

  if v_completion_id is null or v_already_completed then
    raise exception 'First Daily Challenge completion did not create a new receipt';
  end if;

  select completion_id, already_completed into v_completion_id, v_already_completed
    from public.complete_daily_challenge(
      v_challenge_id,
      v_challenge_date,
      'd1000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      v_attempt_id
    );

  if v_completion_id is null or not v_already_completed then
    raise exception 'Daily Challenge completion replay was not idempotent';
  end if;
end
$;

-- Student B must not see or mutate project A. B also cannot use A's quiz or attempt.

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
do $$
begin
  begin
    perform * from public.start_attempt('e1000000-0000-4000-8000-000000000001', 'practice', 5, null);
    raise exception 'Student B unexpectedly started Student A quiz';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    perform * from public.submit_answer(
      current_setting('test.daily_attempt_id')::uuid,
      'f1000000-0000-4000-8000-000000000001',
      0
    );
    raise exception 'Student B unexpectedly submitted an answer to Student A attempt';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    perform * from public.complete_daily_challenge(
      'invalid-cross-user-challenge',
      (now() at time zone 'Asia/Qatar')::date,
      'd1000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      (select id from public.quiz_attempts where quiz_id = 'e1000000-0000-4000-8000-000000000001' limit 1)
    );
    raise exception 'Student B unexpectedly completed Student A Daily Challenge';
  exception when sqlstate 'P0002' then null;
  end;

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
