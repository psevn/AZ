-- Move answer keys out of the API-exposed schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE TABLE IF NOT EXISTS private.question_keys (
  question_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  correct_index smallint NOT NULL CHECK (correct_index >= 0),
  explanation text,
  CONSTRAINT question_keys_question_owner_fk
    FOREIGN KEY (question_id, user_id)
    REFERENCES public.quiz_questions (id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE private.question_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.question_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.question_keys TO postgres, service_role;

INSERT INTO private.question_keys (question_id, user_id, correct_index, explanation)
SELECT id, user_id, correct_index, explanation
FROM public.quiz_questions
ON CONFLICT (question_id) DO NOTHING;

ALTER TABLE public.quiz_questions
  DROP COLUMN correct_index,
  DROP COLUMN explanation;

-- Client may read question content and their own submitted attempts only.
DROP POLICY IF EXISTS quiz_questions_own ON public.quiz_questions;
DROP POLICY IF EXISTS temporary_block_client_quiz_questions ON public.quiz_questions;
CREATE POLICY quiz_questions_read_own
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.quiz_questions FROM anon, authenticated;
GRANT SELECT ON TABLE public.quiz_questions TO authenticated;

DROP POLICY IF EXISTS quiz_attempts_own ON public.quiz_attempts;
DROP POLICY IF EXISTS temporary_block_client_quiz_attempts ON public.quiz_attempts;
CREATE POLICY quiz_attempts_read_own
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.quiz_attempts FROM anon, authenticated;
GRANT SELECT ON TABLE public.quiz_attempts TO authenticated;

-- The only client-facing grading path: answer keys are read and attempts written
-- inside this SECURITY DEFINER function after ownership and input validation.
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
  RETURNING id, public.quiz_attempts.created_at
    INTO v_attempt_id, v_created_at;

  RETURN QUERY SELECT v_attempt_id, v_is_correct, v_correct_index, v_explanation, v_created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_answer(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, smallint) TO authenticated;
