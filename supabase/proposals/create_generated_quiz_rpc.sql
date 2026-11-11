-- PROPOSAL ONLY — not applied to Supabase.
-- This RPC is required by supabase/functions/generate-quiz.
-- Review and convert to a proper Supabase migration before any deployment.

create or replace function public.create_generated_quiz(
  p_user_id uuid,
  p_document_id uuid,
  p_questions jsonb
)
returns table(quiz_id uuid, questions jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_quiz_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_position integer := 0;
  v_correct_index smallint;
  v_source_page integer;
  v_prompt text;
  v_topic text;
  v_explanation text;
  v_difficulty smallint;
  v_choices jsonb;
  v_safe_questions jsonb := '[]'::jsonb;
begin
  if p_user_id is null or p_document_id is null
     or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) not between 5 and 20 then
    raise exception 'Invalid generated quiz input' using errcode = '22023';
  end if;

  perform 1
    from public.documents d
   where d.id = p_document_id
     and d.user_id = p_user_id
     and d.status = 'ready';
  if not found then
    raise exception 'Ready document not found for user' using errcode = 'P0002';
  end if;

  insert into public.quizzes(user_id, document_id, mode)
  values (p_user_id, p_document_id, 'standard')
  returning id into v_quiz_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_position := v_position + 1;
    v_prompt := nullif(btrim(v_question->>'prompt'), '');
    v_topic := nullif(btrim(v_question->>'topic'), '');
    v_explanation := nullif(btrim(v_question->>'explanation'), '');
    v_choices := v_question->'choices';

    if v_prompt is null or v_topic is null or v_explanation is null
       or jsonb_typeof(v_choices) <> 'array'
       or jsonb_array_length(v_choices) <> 4
       or exists (
         select 1 from jsonb_array_elements(v_choices) c
          where jsonb_typeof(c) <> 'string' or btrim(c #>> '{}') = ''
       ) then
      raise exception 'Invalid question content at position %', v_position using errcode = '22023';
    end if;

    if (v_question->>'correct_index') !~ '^[0-3]$'
       or (v_question->>'source_page') !~ '^[1-9][0-9]*$'
       or (v_question->>'difficulty') !~ '^[1-3]$' then
      raise exception 'Invalid question metadata at position %', v_position using errcode = '22023';
    end if;

    v_correct_index := (v_question->>'correct_index')::smallint;
    v_source_page := (v_question->>'source_page')::integer;
    v_difficulty := (v_question->>'difficulty')::smallint;

    perform 1
      from public.document_pages dp
     where dp.document_id = p_document_id
       and dp.user_id = p_user_id
       and dp.page_no = v_source_page;
    if not found then
      raise exception 'Question cites a page outside the selected document' using errcode = '22023';
    end if;

    insert into public.quiz_questions(
      user_id, quiz_id, prompt, choices, question_type, source_page, topic, difficulty
    )
    values (
      p_user_id, v_quiz_id, v_prompt, v_choices, 'mcq', v_source_page, v_topic, v_difficulty
    )
    returning id into v_question_id;

    insert into private.question_keys(question_id, user_id, correct_index, explanation)
    values (v_question_id, p_user_id, v_correct_index, v_explanation);

    v_safe_questions := v_safe_questions || jsonb_build_array(jsonb_build_object(
      'id', v_question_id,
      'position', v_position,
      'prompt', v_prompt,
      'choices', v_choices,
      'source_page', v_source_page,
      'topic', v_topic,
      'difficulty', v_difficulty
    ));
  end loop;

  return query select v_quiz_id, v_safe_questions;
end;
$function$;

revoke all on function public.create_generated_quiz(uuid, uuid, jsonb) from public;
revoke all on function public.create_generated_quiz(uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.create_generated_quiz(uuid, uuid, jsonb) to service_role;
