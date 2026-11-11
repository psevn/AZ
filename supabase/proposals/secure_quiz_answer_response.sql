-- PROPOSAL ONLY — not applied to Supabase.
-- Review against the exact live function definitions before creating a migration.
-- This secures one answer submission; it does NOT create a quiz-session lifecycle.

-- The existing public function exposes correct_index in its return type. PostgreSQL
-- cannot change a function's OUT/RETURNS TABLE shape with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.submit_answer(uuid, smallint);

-- The private implementation also returns the answer key. Keep it callable only by
-- trusted function owners; the public SECURITY DEFINER wrapper below calls it.
REVOKE ALL ON FUNCTION private.submit_answer(uuid, smallint)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_answer_safe(
  p_question_id uuid,
  p_chosen_index smallint
)
RETURNS TABLE (
  answer_id uuid,
  is_correct boolean,
  explanation text,
  answered_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT
      result.attempt_id AS answer_id,
      result.is_correct,
      result.explanation,
      result.created_at AS answered_at
    FROM private.submit_answer(p_question_id, p_chosen_index) AS result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_answer_safe(uuid, smallint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_answer_safe(uuid, smallint)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
