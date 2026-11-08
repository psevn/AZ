-- M4 (APPLIED live 2026-11-08): database support for the V1 Final Scope (docs/V1_SCOPE.md), beta-1 part.
--   * question metadata: type (mcq only for now), source_page, topic, difficulty; documents.language
--   * attempts get a MODE: 'practice' (answer revealed per question, as before) or 'exam'
--       - exam: correct answers stay hidden until the attempt is finished; answers can be changed until then;
--         optional time limit enforced on the SERVER (start + limit + 5 s grace); review only after finish
--   * attempt_questions: the exact question set (and order) of an attempt, so an exam can use N random questions
--   * private.get_attempt_review: per-question review (chosen, correct, explanation, source page), finished attempts only
--   * flashcards + flashcard_progress (progress written only through private.mark_flashcard)
-- Short-answer questions are NOT enabled yet (question_type is restricted to 'mcq'): grading them needs its own design.
-- Tables touched are empty at this point (guard below).

do $guard$
begin
  if exists (select 1 from public.attempt_answers) or exists (select 1 from public.quiz_attempts) then
    raise exception 'attempts are not empty; aborting';
  end if;
end
$guard$;

-- ------------------------------------------------ question + document metadata
alter table public.quiz_questions
  add column question_type text not null default 'mcq' check (question_type = 'mcq'),
  add column source_page integer check (source_page is null or source_page >= 1),
  add column topic text check (topic is null or char_length(topic) between 1 and 120),
  add column difficulty smallint check (difficulty is null or difficulty between 1 and 3);
create index quiz_questions_topic_idx on public.quiz_questions (user_id, topic) where topic is not null;

alter table public.documents
  add column language text check (language is null or language in ('ar', 'en', 'mixed'));

-- ------------------------------------------------ attempt mode + question set
alter table public.quiz_attempts
  add column mode text not null default 'practice' check (mode in ('practice', 'exam')),
  add column time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 60 and 14400),
  add constraint quiz_attempts_limit_only_exam check (time_limit_seconds is null or mode = 'exam');

create table public.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null,
  question_id uuid not null,
  position_no integer not null check (position_no >= 1),
  unique (attempt_id, question_id),
  unique (attempt_id, position_no),
  foreign key (attempt_id, user_id) references public.quiz_attempts (id, user_id) on delete cascade,
  foreign key (question_id, user_id) references public.quiz_questions (id, user_id) on delete cascade
);
create index attempt_questions_user_idx on public.attempt_questions (user_id);
create index attempt_questions_attempt_user_idx on public.attempt_questions (attempt_id, user_id);
create index attempt_questions_question_user_idx on public.attempt_questions (question_id, user_id);

-- an answer must belong to a question that is part of the attempt
alter table public.attempt_answers
  add constraint attempt_answers_in_attempt_fkey
  foreign key (attempt_id, question_id) references public.attempt_questions (attempt_id, question_id) on delete cascade;

alter table public.attempt_questions enable row level security;
revoke all on public.attempt_questions from anon, authenticated;
grant select on public.attempt_questions to authenticated;
create policy attempt_questions_read_own on public.attempt_questions
  for select to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------ flashcards
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 4000),
  source_page integer check (source_page is null or source_page >= 1),
  topic text check (topic is null or char_length(topic) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);
create index flashcards_user_idx on public.flashcards (user_id);
create index flashcards_document_user_idx on public.flashcards (document_id, user_id);

create table public.flashcard_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  flashcard_id uuid not null,
  status text not null check (status in ('known', 'needs_review')),
  review_count integer not null default 1 check (review_count >= 1),
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, flashcard_id),
  foreign key (flashcard_id, user_id) references public.flashcards (id, user_id) on delete cascade
);
create index flashcard_progress_flashcard_user_idx on public.flashcard_progress (flashcard_id, user_id);

alter table public.flashcards enable row level security;
alter table public.flashcard_progress enable row level security;
revoke all on public.flashcards, public.flashcard_progress from anon, authenticated;
grant select on public.flashcards, public.flashcard_progress to authenticated;
create policy flashcards_read_own on public.flashcards
  for select to authenticated using (user_id = (select auth.uid()));
create policy flashcard_progress_read_own on public.flashcard_progress
  for select to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------ start_attempt (new signature)
drop function public.start_attempt(uuid);
drop function private.start_attempt(uuid);

create function private.start_attempt(p_quiz_id uuid, p_mode text default 'practice',
  p_question_count integer default null, p_time_limit_seconds integer default null)
 returns table(attempt_id uuid, started_at timestamptz, question_count integer, deadline timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_attempt uuid;
  v_started timestamptz;
  v_available integer;
  v_n integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_quiz_id is null or p_mode is null or p_mode not in ('practice', 'exam')
     or (p_question_count is not null and p_question_count < 1)
     or (p_time_limit_seconds is not null and (p_mode <> 'exam' or p_time_limit_seconds not between 60 and 14400)) then
    raise exception 'Invalid input' using errcode = '22023';
  end if;

  perform 1 from public.quizzes as z where z.id = p_quiz_id and z.user_id = v_user;
  if not found then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  select count(*) into v_available from public.quiz_questions as q
   where q.quiz_id = p_quiz_id and q.user_id = v_user;
  if v_available = 0 then
    raise exception 'Quiz has no questions' using errcode = '22023';
  end if;
  v_n := least(coalesce(p_question_count, v_available), v_available);

  insert into public.quiz_attempts as qa (user_id, quiz_id, mode, time_limit_seconds)
  values (v_user, p_quiz_id, p_mode, p_time_limit_seconds)
  returning qa.id, qa.started_at into v_attempt, v_started;

  insert into public.attempt_questions as aq (user_id, attempt_id, question_id, position_no)
  select v_user, v_attempt, t.id, row_number() over (order by t.r, t.id)
    from (select q.id, case when p_mode = 'exam' then random() else 0 end as r
            from public.quiz_questions as q
           where q.quiz_id = p_quiz_id and q.user_id = v_user
           order by r, q.id
           limit v_n) as t;

  return query select v_attempt, v_started, v_n,
    case when p_time_limit_seconds is null then null::timestamptz
         else v_started + make_interval(secs => p_time_limit_seconds) end;
end;
$function$;

-- ------------------------------------------------ submit_answer (same signature, mode-aware)
create or replace function private.submit_answer(p_attempt_id uuid, p_question_id uuid, p_chosen_index smallint)
 returns table(is_correct boolean, correct_index smallint, explanation text, answered_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_quiz uuid;
  v_finished timestamptz;
  v_mode text;
  v_limit integer;
  v_started timestamptz;
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

  select qa.quiz_id, qa.finished_at, qa.mode, qa.time_limit_seconds, qa.started_at
    into v_quiz, v_finished, v_mode, v_limit, v_started
  from public.quiz_attempts as qa
  where qa.id = p_attempt_id and qa.user_id = v_user
  for update;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_finished is not null then
    raise exception 'Attempt already finished' using errcode = '55000';
  end if;
  if v_limit is not null and now() > v_started + make_interval(secs => v_limit + 5) then
    raise exception 'Time is up' using errcode = '55000';
  end if;

  select jsonb_array_length(q.choices), k.correct_index, k.explanation
    into v_choice_count, v_correct, v_expl
  from public.attempt_questions as aq
  join public.quiz_questions as q on q.id = aq.question_id and q.user_id = aq.user_id
  join private.question_keys as k on k.question_id = q.id and k.user_id = q.user_id
  where aq.attempt_id = p_attempt_id and aq.question_id = p_question_id and aq.user_id = v_user
    and q.quiz_id = v_quiz;
  if not found then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if p_chosen_index >= v_choice_count or v_correct >= v_choice_count then
    raise exception 'Answer index out of range' using errcode = '22023';
  end if;

  v_ok := (p_chosen_index = v_correct);

  if v_mode = 'exam' then
    -- answers may be changed until the attempt is finished; nothing is revealed
    insert into public.attempt_answers as aa (user_id, attempt_id, question_id, chosen_index, is_correct)
    values (v_user, p_attempt_id, p_question_id, p_chosen_index, v_ok)
    on conflict (attempt_id, question_id)
    do update set chosen_index = excluded.chosen_index, is_correct = excluded.is_correct, answered_at = now()
    returning aa.answered_at into v_answered;
    return query select null::boolean, null::smallint, null::text, v_answered;
    return;
  end if;

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

-- ------------------------------------------------ finish_attempt (total = the attempt's own question set)
create or replace function private.finish_attempt(p_attempt_id uuid)
 returns table(score numeric, correct_count integer, total_questions integer, finished_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
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

  select qa.finished_at, qa.score into v_finished, v_score
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
  from public.attempt_questions as aq
  where aq.attempt_id = p_attempt_id and aq.user_id = v_user;

  if v_finished is null then
    v_score := case when v_total > 0 then round(100.0 * v_correct / v_total, 2) else 0 end;
    update public.quiz_attempts as qa
       set score = v_score, finished_at = now()
     where qa.id = p_attempt_id and qa.user_id = v_user
    returning qa.finished_at into v_finished;
  end if;

  return query select v_score, v_correct, v_total, v_finished;
end;
$function$;

-- ------------------------------------------------ review (finished attempts only)
create function private.get_attempt_review(p_attempt_id uuid)
 returns table(r_question_id uuid, r_position integer, r_prompt text, r_choices jsonb, r_chosen_index smallint,
               r_is_correct boolean, r_correct_index smallint, r_explanation text, r_source_page integer, r_topic text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_finished timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_attempt_id is null then
    raise exception 'Invalid input' using errcode = '22023';
  end if;
  select qa.finished_at into v_finished from public.quiz_attempts as qa
   where qa.id = p_attempt_id and qa.user_id = v_user;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_finished is null then
    raise exception 'Attempt not finished' using errcode = '55000';
  end if;

  return query
    select q.id, aq.position_no, q.prompt, q.choices, aa.chosen_index, coalesce(aa.is_correct, false),
           k.correct_index, k.explanation, q.source_page, q.topic
      from public.attempt_questions as aq
      join public.quiz_questions as q on q.id = aq.question_id and q.user_id = aq.user_id
      join private.question_keys as k on k.question_id = q.id and k.user_id = q.user_id
      left join public.attempt_answers as aa
             on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id and aa.user_id = aq.user_id
     where aq.attempt_id = p_attempt_id and aq.user_id = v_user
     order by aq.position_no;
end;
$function$;

-- ------------------------------------------------ flashcard progress
create function private.mark_flashcard(p_flashcard_id uuid, p_status text)
 returns table(r_status text, r_review_count integer)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_flashcard_id is null or p_status is null or p_status not in ('known', 'needs_review') then
    raise exception 'Invalid input' using errcode = '22023';
  end if;
  perform 1 from public.flashcards as f where f.id = p_flashcard_id and f.user_id = v_user;
  if not found then
    raise exception 'Flashcard not found' using errcode = 'P0002';
  end if;

  insert into public.flashcard_progress as fp (user_id, flashcard_id, status)
  values (v_user, p_flashcard_id, p_status)
  on conflict (user_id, flashcard_id)
  do update set status = excluded.status, review_count = fp.review_count + 1, last_reviewed_at = now()
  returning fp.status, fp.review_count into v_status, v_count;

  return query select v_status, v_count;
end;
$function$;

-- ------------------------------------------------ public wrappers (INVOKER)
create function public.start_attempt(p_quiz_id uuid, p_mode text default 'practice',
  p_question_count integer default null, p_time_limit_seconds integer default null)
 returns table(attempt_id uuid, started_at timestamptz, question_count integer, deadline timestamptz)
 language sql set search_path to ''
as $function$ select * from private.start_attempt(p_quiz_id, p_mode, p_question_count, p_time_limit_seconds); $function$;

create function public.get_attempt_review(p_attempt_id uuid)
 returns table(r_question_id uuid, r_position integer, r_prompt text, r_choices jsonb, r_chosen_index smallint,
               r_is_correct boolean, r_correct_index smallint, r_explanation text, r_source_page integer, r_topic text)
 language sql set search_path to ''
as $function$ select * from private.get_attempt_review(p_attempt_id); $function$;

create function public.mark_flashcard(p_flashcard_id uuid, p_status text)
 returns table(r_status text, r_review_count integer)
 language sql set search_path to ''
as $function$ select * from private.mark_flashcard(p_flashcard_id, p_status); $function$;

-- ------------------------------------------------ grants (deny-first)
revoke execute on function private.start_attempt(uuid, text, integer, integer), private.get_attempt_review(uuid),
  private.mark_flashcard(uuid, text) from public, anon, service_role;
grant execute on function private.start_attempt(uuid, text, integer, integer), private.get_attempt_review(uuid),
  private.mark_flashcard(uuid, text) to authenticated;

revoke execute on function public.start_attempt(uuid, text, integer, integer), public.get_attempt_review(uuid),
  public.mark_flashcard(uuid, text) from public, anon;
grant execute on function public.start_attempt(uuid, text, integer, integer), public.get_attempt_review(uuid),
  public.mark_flashcard(uuid, text) to authenticated, service_role;
