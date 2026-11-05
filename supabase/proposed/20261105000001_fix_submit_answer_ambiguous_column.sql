-- PROPOSED (not applied to the live project). Tested on the local replica only.
--
-- Bug found by tests/live_schema_tests.py on 2026-11-05:
--   private.submit_answer() fails for every valid answer with
--     42702: column reference "created_at" is ambiguous
--   because the function RETURNS TABLE (..., created_at ...), which makes
--   "created_at" (and is_correct, correct_index, explanation) PL/pgSQL output
--   variables that collide with the column named in
--     INSERT ... RETURNING id, created_at INTO ...
--
-- Fix: table-qualify the RETURNING list through an alias. Behaviour, signature,
-- checks and privileges are otherwise unchanged (CREATE OR REPLACE keeps the ACL).

create or replace function private.submit_answer(p_question_id uuid, p_chosen_index smallint)
 returns table(attempt_id uuid, is_correct boolean, correct_index smallint, explanation text, created_at timestamp with time zone)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_choice_count integer;
  v_correct_index smallint;
  v_explanation text;
  v_is_correct boolean;
  v_attempt_id uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_question_id is null or p_chosen_index is null or p_chosen_index < 0 then
    raise exception 'Invalid answer input' using errcode = '22023';
  end if;

  select jsonb_array_length(q.choices), k.correct_index, k.explanation
    into v_choice_count, v_correct_index, v_explanation
  from public.quiz_questions as q
  join private.question_keys as k
    on k.question_id = q.id and k.user_id = q.user_id
  where q.id = p_question_id and q.user_id = v_user_id
  for share of q;

  if not found then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if p_chosen_index >= v_choice_count or v_correct_index >= v_choice_count then
    raise exception 'Answer index out of range' using errcode = '22023';
  end if;

  v_is_correct := (p_chosen_index = v_correct_index);

  insert into public.quiz_attempts as qa (user_id, question_id, chosen_index, is_correct)
  values (v_user_id, p_question_id, p_chosen_index, v_is_correct)
  returning qa.id, qa.created_at into v_attempt_id, v_created_at;

  return query select v_attempt_id, v_is_correct, v_correct_index, v_explanation, v_created_at;
end;
$function$;
