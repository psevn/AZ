-- M2 (APPLIED live 2026-11-05): per-quiz attempts with a score (SPEC §5.4), replacing the per-question
-- quiz_attempts model. Approved by PSEVN 2026-11-05 ("fix the gaps").
--   quiz_attempts  : one row per attempt at a quiz (started_at, finished_at, score)
--   attempt_answers: one row per answered question, unique per (attempt, question)
--   RPCs           : start_attempt, submit_answer(attempt, question, choice), finish_attempt
-- Clients never write these tables; grading happens in SECURITY DEFINER functions in `private`
-- with thin SECURITY INVOKER wrappers in `public` (same pattern as the existing RPC).
-- The old tables/functions are empty/unused, guarded below.

do $guard$
begin
  if exists (select 1 from public.quiz_attempts) then
    raise exception 'public.quiz_attempts is not empty; aborting (data would be lost)';
  end if;
end
$guard$;

drop function if exists public.submit_answer(uuid, smallint);
drop function if exists private.submit_answer(uuid, smallint);
drop table public.quiz_attempts;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null,
  score numeric check (score is null or (score >= 0 and score <= 100)),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade,
  check (finished_at is null or finished_at >= started_at)
);
create index quiz_attempts_user_started_idx on public.quiz_attempts (user_id, started_at desc);
create index quiz_attempts_quiz_user_idx on public.quiz_attempts (quiz_id, user_id);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null,
  question_id uuid not null,
  chosen_index smallint not null check (chosen_index >= 0),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  foreign key (attempt_id, user_id) references public.quiz_attempts (id, user_id) on delete cascade,
  foreign key (question_id, user_id) references public.quiz_questions (id, user_id) on delete cascade
);
create index attempt_answers_user_idx on public.attempt_answers (user_id);
create index attempt_answers_attempt_user_idx on public.attempt_answers (attempt_id, user_id);
create index attempt_answers_question_user_idx on public.attempt_answers (question_id, user_id);

alter table public.quiz_attempts enable row level security;
alter table public.attempt_answers enable row level security;
revoke all on public.quiz_attempts, public.attempt_answers from anon, authenticated;
grant select on public.quiz_attempts, public.attempt_answers to authenticated;
create policy quiz_attempts_read_own on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy attempt_answers_read_own on public.attempt_answers
  for select to authenticated using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- start
create function private.start_attempt(p_quiz_id uuid)
 returns table(attempt_id uuid, started_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_attempt uuid;
  v_started timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_quiz_id is null then
    raise exception 'Invalid input' using errcode = '22023';
  end if;

  perform 1 from public.quizzes as z where z.id = p_quiz_id and z.user_id = v_user;
  if not found then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  insert into public.quiz_attempts as qa (user_id, quiz_id)
  values (v_user, p_quiz_id)
  returning qa.id, qa.started_at into v_attempt, v_started;

  return query select v_attempt, v_started;
end;
$function$;

-- --------------------------------------------------------------- submit
create function private.submit_answer(p_attempt_id uuid, p_question_id uuid, p_chosen_index smallint)
 returns table(is_correct boolean, correct_index smallint, explanation text, answered_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_quiz uuid;
  v_finished timestamptz;
  v_choice_count integer;
  v_correct smallint;
  v_expl text;
  v_ok boolean;
  v_answered timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_attempt_id is null or p_question_id is null or p_chosen_index is null or p_chosen_index < 0 then
    raise exception 'Invalid answer input' using errcode = '22023';
  end if;

  -- Lock the attempt row: serialises concurrent submits/finish for the same attempt.
  select qa.quiz_id, qa.finished_at into v_quiz, v_finished
  from public.quiz_attempts as qa
  where qa.id = p_attempt_id and qa.user_id = v_user
  for update;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_finished is not null then
    raise exception 'Attempt already finished' using errcode = '55000';
  end if;

  select jsonb_array_length(q.choices), k.correct_index, k.explanation
    into v_choice_count, v_correct, v_expl
  from public.quiz_questions as q
  join private.question_keys as k on k.question_id = q.id and k.user_id = q.user_id
  where q.id = p_question_id and q.quiz_id = v_quiz and q.user_id = v_user;
  if not found then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if p_chosen_index >= v_choice_count or v_correct >= v_choice_count then
    raise exception 'Answer index out of range' using errcode = '22023';
  end if;

  v_ok := (p_chosen_index = v_correct);

  begin
    insert into public.attempt_answers as aa (user_id, attempt_id, question_id, chosen_index, is_correct)
    values (v_user, p_attempt_id, p_question_id, p_chosen_index, v_ok)
    returning aa.answered_at into v_answered;
  exception when unique_violation then
    raise exception 'Question already answered in this attempt' using errcode = '23505';
  end;

  return query select v_ok, v_correct, v_expl, v_answered;
end;
$function$;

-- --------------------------------------------------------------- finish
create function private.finish_attempt(p_attempt_id uuid)
 returns table(score numeric, correct_count integer, total_questions integer, finished_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_quiz uuid;
  v_finished timestamptz;
  v_score numeric;
  v_correct integer;
  v_total integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_attempt_id is null then
    raise exception 'Invalid input' using errcode = '22023';
  end if;

  select qa.quiz_id, qa.finished_at, qa.score into v_quiz, v_finished, v_score
  from public.quiz_attempts as qa
  where qa.id = p_attempt_id and qa.user_id = v_user
  for update;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  select count(*) filter (where aa.is_correct) into v_correct
  from public.attempt_answers as aa
  where aa.attempt_id = p_attempt_id and aa.user_id = v_user;

  select count(*) into v_total
  from public.quiz_questions as q
  where q.quiz_id = v_quiz and q.user_id = v_user;

  if v_finished is null then
    -- unanswered questions count as wrong
    v_score := case when v_total > 0 then round(100.0 * v_correct / v_total, 2) else 0 end;
    update public.quiz_attempts as qa
       set score = v_score, finished_at = now()
     where qa.id = p_attempt_id and qa.user_id = v_user
    returning qa.finished_at into v_finished;
  end if;

  return query select v_score, v_correct, v_total, v_finished;
end;
$function$;

-- ----------------------------------------------- public wrappers (INVOKER)
create function public.start_attempt(p_quiz_id uuid)
 returns table(attempt_id uuid, started_at timestamptz)
 language sql
 set search_path to ''
as $function$
  select * from private.start_attempt(p_quiz_id);
$function$;

create function public.submit_answer(p_attempt_id uuid, p_question_id uuid, p_chosen_index smallint)
 returns table(is_correct boolean, correct_index smallint, explanation text, answered_at timestamptz)
 language sql
 set search_path to ''
as $function$
  select * from private.submit_answer(p_attempt_id, p_question_id, p_chosen_index);
$function$;

create function public.finish_attempt(p_attempt_id uuid)
 returns table(score numeric, correct_count integer, total_questions integer, finished_at timestamptz)
 language sql
 set search_path to ''
as $function$
  select * from private.finish_attempt(p_attempt_id);
$function$;

-- Supabase grants EXECUTE on new functions to anon/authenticated/service_role by default: lock down.
revoke execute on function private.start_attempt(uuid), private.submit_answer(uuid, uuid, smallint),
  private.finish_attempt(uuid) from public, anon, service_role;
grant execute on function private.start_attempt(uuid), private.submit_answer(uuid, uuid, smallint),
  private.finish_attempt(uuid) to authenticated;

revoke execute on function public.start_attempt(uuid), public.submit_answer(uuid, uuid, smallint),
  public.finish_attempt(uuid) from public, anon;
grant execute on function public.start_attempt(uuid), public.submit_answer(uuid, uuid, smallint),
  public.finish_attempt(uuid) to authenticated, service_role;
