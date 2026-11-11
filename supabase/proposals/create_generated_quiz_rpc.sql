-- PROPOSAL ONLY — not applied to Supabase.
-- Required by supabase/functions/generate-quiz.
-- Reconcile against the exact migration history and test on a local Supabase database
-- before converting this proposal into a numbered migration.

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
  v_seen_prompts text[] := array[]::text[];
begin
  if p_user_id is null or p_document_id is null or p_questions is null then
    raise exception 'Invalid generated quiz input' using errcode = '22023';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Generated questions must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_questions) not between 5 and 20 then
    raise exception 'Generated quiz must contain between 5 and 20 questions' using errcode = '22023';
  end if;

  -- This RPC is service-role-only. The caller must derive p_user_id from a
  -- verified Supabase Auth user; this check additionally binds it to the document.
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

    if jsonb_typeof(v_question) is distinct from 'object' then
      raise exception 'Question % must be a JSON object', v_position using errcode = '22023';
    end if;

    if jsonb_object_length(v_question) <> 7
       or (v_question - array[
         'prompt', 'choices', 'correct_index', 'source_page',
         'topic', 'explanation', 'difficulty'
       ]) <> '{}'::jsonb then
      raise exception 'Invalid question fields at position %', v_position using errcode = '22023';
    end if;

    v_prompt := nullif(btrim(v_question->>'prompt'), '');
    v_topic := nullif(btrim(v_question->>'topic'), '');
    v_explanation := nullif(btrim(v_question->>'explanation'), '');
    v_choices := v_question->'choices';

    if v_prompt is null or char_length(v_prompt) > 2000
       or v_topic is null or char_length(v_topic) > 120
       or v_explanation is null or char_length(v_explanation) > 4000 then
      raise exception 'Invalid question text at position %', v_position using errcode = '22023';
    end if;

    if jsonb_typeof(v_choices) is distinct from 'array' then
      raise exception 'Question choices must be an array at position %', v_position using errcode = '22023';
    end if;

    if jsonb_array_length(v_choices) <> 4 then
      raise exception 'Question must have four choices at position %', v_position using errcode = '22023';
    end if;

    if exists (
         select 1
           from jsonb_array_elements(v_choices) c
          where jsonb_typeof(c) is distinct from 'string'
             or btrim(c #>> '{}') = ''
             or char_length(btrim(c #>> '{}')) > 500
       )
       or (
         select count(distinct lower(btrim(c #>> '{}')))
           from jsonb_array_elements(v_choices) c
       ) <> 4 then
      raise exception 'Invalid question choices at position %', v_position using errcode = '22023';
    end if;

    if lower(v_prompt) = any(v_seen_prompts) then
      raise exception 'Duplicate question prompt at position %', v_position using errcode = '22023';
    end if;
    v_seen_prompts := array_append(v_seen_prompts, lower(v_prompt));

    if jsonb_typeof(v_question->'correct_index') is distinct from 'number'
       or (v_question->>'correct_index') !~ '^[0-3]$'
       or jsonb_typeof(v_question->'source_page') is distinct from 'number'
       or (v_question->>'source_page') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(v_question->'difficulty') is distinct from 'number'
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

    -- Answer keys and explanations stay in the private schema.
    insert into private.question_keys(question_id, user_id, correct_index, explanation)
    values (v_question_id, p_user_id, v_correct_index, v_explanation);

    -- Only non-secret question content is returned to the Edge Function/browser.
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

revoke all on function public.create_generated_quiz(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_generated_quiz(uuid, uuid, jsonb) to service_role;
