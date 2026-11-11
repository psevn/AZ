-- Generated with Supabase CLI v3.1.0 after isolated PostgreSQL 17 integration testing.
-- This migration is not deployed; full AZ migration baseline reconciliation is still required.
-- Durable, idempotent completion receipt for a quiz-backed Daily Challenge.
-- No points/ledger are created by this proposal.

create table public.azi_daily_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_date date not null,
  challenge_id text not null,
  document_id uuid not null,
  quiz_id uuid not null,
  attempt_id uuid not null,
  question_count integer not null check (question_count = 5),
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  finished_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint azi_daily_challenge_user_day_key unique (user_id, challenge_date),
  constraint azi_daily_challenge_id_key unique (user_id, challenge_id),
  constraint azi_daily_challenge_attempt_key unique (attempt_id),
  constraint azi_daily_challenge_document_owner_fkey
    foreign key (document_id, user_id) references public.documents(id, user_id) on delete cascade,
  constraint azi_daily_challenge_quiz_owner_fkey
    foreign key (quiz_id, user_id) references public.quizzes(id, user_id) on delete cascade,
  constraint azi_daily_challenge_attempt_owner_fkey
    foreign key (attempt_id, user_id) references public.quiz_attempts(id, user_id) on delete cascade
);

alter table public.azi_daily_challenge_completions enable row level security;

revoke all on table public.azi_daily_challenge_completions from public, anon, authenticated;
grant select on table public.azi_daily_challenge_completions to authenticated;

create policy "Users can read their own Daily Challenge completions"
  on public.azi_daily_challenge_completions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.complete_daily_challenge(
  p_challenge_id text,
  p_challenge_date date,
  p_document_id uuid,
  p_quiz_id uuid,
  p_attempt_id uuid
)
returns table (
  completion_id uuid,
  challenge_id text,
  challenge_date date,
  quiz_id uuid,
  attempt_id uuid,
  question_count integer,
  score numeric,
  finished_at timestamptz,
  already_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_expected_challenge_id text;
  v_completion public.azi_daily_challenge_completions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_challenge_id is null or p_challenge_date is null
     or p_document_id is null or p_quiz_id is null or p_attempt_id is null then
    raise exception 'Daily Challenge completion input is incomplete' using errcode = '22023';
  end if;

  select
    qa.quiz_id,
    qa.started_at,
    qa.finished_at,
    qa.score,
    q.document_id,
    d.status as document_status,
    count(aq.id)::integer as question_count
  into v_attempt
  from public.quiz_attempts qa
  join public.quizzes q
    on q.id = qa.quiz_id and q.user_id = qa.user_id
  join public.documents d
    on d.id = q.document_id and d.user_id = q.user_id
  left join public.attempt_questions aq
    on aq.attempt_id = qa.id and aq.user_id = qa.user_id
  where qa.id = p_attempt_id
    and qa.user_id = v_user_id
    and qa.quiz_id = p_quiz_id
    and q.document_id = p_document_id
    and d.status = 'ready'
    and qa.mode = 'practice'
    and qa.finished_at is not null
    and qa.score is not null
  group by qa.quiz_id, qa.started_at, qa.finished_at, qa.score, q.document_id, d.status;

  if not found then
    raise exception 'No matching completed practice attempt was found' using errcode = 'P0002';
  end if;

  if v_attempt.question_count <> 5 then
    raise exception 'Daily Challenge requires exactly five completed attempt questions' using errcode = '22023';
  end if;

  if (v_attempt.started_at at time zone 'Asia/Qatar')::date <> p_challenge_date then
    raise exception 'Challenge date does not match the attempt start day in Qatar' using errcode = '22023';
  end if;

  v_expected_challenge_id :=
    to_char(p_challenge_date, 'YYYY-MM-DD')
    || ':practice_study_pack:' || p_document_id::text || ':' || p_quiz_id::text;

  if p_challenge_id <> v_expected_challenge_id then
    raise exception 'Challenge identity does not match its document and quiz' using errcode = '22023';
  end if;

  insert into public.azi_daily_challenge_completions (
    user_id, challenge_date, challenge_id, document_id, quiz_id,
    attempt_id, question_count, score, finished_at
  )
  values (
    v_user_id, p_challenge_date, p_challenge_id, p_document_id, p_quiz_id,
    p_attempt_id, v_attempt.question_count, v_attempt.score, v_attempt.finished_at
  )
  on conflict do nothing
  returning * into v_completion;

  if v_completion.id is not null then
    return query select
      v_completion.id, v_completion.challenge_id, v_completion.challenge_date,
      v_completion.quiz_id, v_completion.attempt_id, v_completion.question_count,
      v_completion.score, v_completion.finished_at, false;
    return;
  end if;

  select *
    into v_completion
    from public.azi_daily_challenge_completions c
   where c.user_id = v_user_id
     and c.challenge_date = p_challenge_date;

  if not found or v_completion.challenge_id <> p_challenge_id then
    raise exception 'A different Daily Challenge is already completed for this day' using errcode = '23505';
  end if;

  return query select
    v_completion.id, v_completion.challenge_id, v_completion.challenge_date,
    v_completion.quiz_id, v_completion.attempt_id, v_completion.question_count,
    v_completion.score, v_completion.finished_at, true;
end;
$function$;

revoke all on function public.complete_daily_challenge(text, date, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.complete_daily_challenge(text, date, uuid, uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
