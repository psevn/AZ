-- Seed two users, one valid challenge attempt, and negative test cases.
insert into auth.users(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');

insert into public.documents(id,user_id,status) values
  ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ready'),
  ('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','ready');

insert into public.quizzes(id,user_id,document_id) values
  ('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002');

insert into public.quiz_attempts(id,user_id,quiz_id,score,started_at,finished_at,mode) values
  ('13000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',80.00,'2026-11-11 10:00:00+03','2026-11-11 10:05:00+03','practice'),
  ('14000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',75.00,'2026-11-11 11:00:00+03','2026-11-11 11:05:00+03','practice'),
  ('15000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',75.00,'2026-11-11 12:00:00+03','2026-11-11 12:05:00+03','exam');

insert into public.attempt_questions(id,attempt_id,user_id)
select
  ('16000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '13000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
from generate_series(1,5) n;

insert into public.attempt_questions(id,attempt_id,user_id)
select
  ('17000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '14000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
from generate_series(1,4) n;

insert into public.attempt_questions(id,attempt_id,user_id)
select
  ('18000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '15000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
from generate_series(1,5) n;

-- The authenticated owner can create a receipt only from their completed practice attempt.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

do $test$
declare
  v record;
begin
  select * into v
  from public.complete_daily_challenge(
    '2026-11-11:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
    '2026-11-11',
    '11000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  );
  if v.already_completed is not false or v.question_count <> 5 or v.score <> 80.00 then
    raise exception 'First completion receipt was not persisted correctly';
  end if;

  select * into v
  from public.complete_daily_challenge(
    '2026-11-11:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
    '2026-11-11',
    '11000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  );
  if v.already_completed is not true then
    raise exception 'Repeated completion was not idempotent';
  end if;

  begin
    perform * from public.complete_daily_challenge(
      '2026-11-11:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
      '2026-11-11',
      '11000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '14000000-0000-4000-8000-000000000001'
    );
    raise exception 'Four-question attempt should have been rejected';
  exception when sqlstate '22023' then
    null;
  end;

  begin
    perform * from public.complete_daily_challenge(
      '2026-11-11:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
      '2026-11-11',
      '11000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '15000000-0000-4000-8000-000000000001'
    );
    raise exception 'Exam-mode attempt should have been rejected';
  exception when sqlstate 'P0002' then
    null;
  end;

  begin
    perform * from public.complete_daily_challenge(
      '2026-11-10:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
      '2026-11-10',
      '11000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000001'
    );
    raise exception 'Wrong Qatar-local challenge date should have been rejected';
  exception when sqlstate '22023' then
    null;
  end;

  if (select count(*) from public.azi_daily_challenge_completions) <> 1 then
    raise exception 'Unexpected number of completion receipts';
  end if;
end;
$test$;

-- RLS hides the owner's receipt from a different authenticated user.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $test$
begin
  if (select count(*) from public.azi_daily_challenge_completions) <> 0 then
    raise exception 'RLS exposed another user completion receipt';
  end if;
end;
$test$;

-- Authenticated clients may read but may not write the receipt table directly.
do $test$
begin
  begin
    insert into public.azi_daily_challenge_completions
      (user_id,challenge_date,challenge_id,document_id,quiz_id,attempt_id,question_count,score,finished_at)
    values
      ('20000000-0000-4000-8000-000000000002','2026-11-11','forged',
       '22000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002',
       '13000000-0000-4000-8000-000000000001',5,100,'2026-11-11 12:00:00+03');
    raise exception 'Direct authenticated insert should have been denied';
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;
reset role;

-- Anonymous users cannot execute the SECURITY DEFINER RPC.
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $test$
begin
  begin
    perform * from public.complete_daily_challenge(
      '2026-11-11:practice_study_pack:11000000-0000-4000-8000-000000000001:12000000-0000-4000-8000-000000000001',
      '2026-11-11',
      '11000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000001'
    );
    raise exception 'Anonymous RPC execution should have been denied';
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;
reset role;

-- Verify the function remains SECURITY DEFINER with an empty search_path,
-- and only authenticated can execute it.
do $test$
declare
  v_prosecdef boolean;
  v_proconfig text[];
begin
  select prosecdef, proconfig into v_prosecdef, v_proconfig
  from pg_proc
  where oid = 'public.complete_daily_challenge(text,date,uuid,uuid,uuid)'::regprocedure;
  if v_prosecdef is not true or not ('search_path=""' = any(v_proconfig)) then
    raise exception 'RPC security definer/search_path configuration is incorrect';
  end if;
  if has_function_privilege('anon','public.complete_daily_challenge(text,date,uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Anonymous role unexpectedly has RPC execute privilege';
  end if;
  if not has_function_privilege('authenticated','public.complete_daily_challenge(text,date,uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Authenticated role is missing RPC execute privilege';
  end if;
  if has_table_privilege('authenticated','public.azi_daily_challenge_completions','INSERT') then
    raise exception 'Authenticated role unexpectedly has direct table insert privilege';
  end if;
end;
$test$;

reset role;
