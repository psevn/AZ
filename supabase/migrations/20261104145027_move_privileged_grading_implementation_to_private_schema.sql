-- Keep the privileged implementation outside PostgREST's exposed public schema.
CREATE OR REPLACE FUNCTION private.submit_answer(
  p_question_id uuid,
  p_chosen_index smallint
)
RETURNS TABLE (
  attempt_id uuid,
  is_correct boolean,
  correct_index smallint,
  explanation text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_choice_count integer;
  v_correct_index smallint;
  v_explanation text;
  v_is_correct boolean;
  v_attempt_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_question_id IS NULL OR p_chosen_index IS NULL OR p_chosen_index < 0 THEN
    RAISE EXCEPTION 'Invalid answer input' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_array_length(q.choices), k.correct_index, k.explanation
    INTO v_choice_count, v_correct_index, v_explanation
  FROM public.quiz_questions AS q
  JOIN private.question_keys AS k
    ON k.question_id = q.id AND k.user_id = q.user_id
  WHERE q.id = p_question_id AND q.user_id = v_user_id
  FOR SHARE OF q;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_chosen_index >= v_choice_count OR v_correct_index >= v_choice_count THEN
    RAISE EXCEPTION 'Answer index out of range' USING ERRCODE = '22023';
  END IF;

  v_is_correct := (p_chosen_index = v_correct_index);

  INSERT INTO public.quiz_attempts (user_id, question_id, chosen_index, is_correct)
  VALUES (v_user_id, p_question_id, p_chosen_index, v_is_correct)
  RETURNING id, created_at INTO v_attempt_id, v_created_at;

  RETURN QUERY SELECT v_attempt_id, v_is_correct, v_correct_index, v_explanation, v_created_at;
END;
$function$;

REVOKE ALL ON FUNCTION private.submit_answer(uuid, smallint) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.submit_answer(uuid, smallint) TO authenticated;

-- The exposed RPC is an invoker wrapper; it has no privileged SQL of its own.
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_question_id uuid,
  p_chosen_index smallint
)
RETURNS TABLE (
  attempt_id uuid,
  is_correct boolean,
  correct_index smallint,
  explanation text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT * FROM private.submit_answer(p_question_id, p_chosen_index);
$function$;

REVOKE ALL ON FUNCTION public.submit_answer(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, smallint) TO authenticated;
