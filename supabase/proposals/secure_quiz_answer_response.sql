-- PROPOSAL ONLY — not applied to Supabase.
-- This contract was reconciled against the live AZ database schema on 2026-11-11.
-- It uses the existing quiz-attempt lifecycle; it does not add or duplicate tables.

-- PostgreSQL cannot change a function's OUT/RETURNS TABLE shape with CREATE OR REPLACE.
-- Drop only the public wrapper; the private implementation remains the grading source.
DROP FUNCTION IF EXISTS public.submit_answer(uuid, uuid, smallint);

-- The private function returns correct_index. Browser users must not call it directly.
REVOKE ALL ON FUNCTION private.submit_answer(uuid, uuid, smallint)
  FROM PUBLIC, anon, authenticated;

-- Keep the existing RPC name and arguments so the browser contract remains stable,
-- but expose no answer-key field. Exam mode intentionally returns NULL correctness
-- and explanation until the attempt is finished and reviewed.
CREATE FUNCTION public.submit_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_chosen_index smallint
)
RETURNS TABLE (
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
    SELECT result.is_correct, result.explanation, result.answered_at
    FROM private.submit_answer(
      p_attempt_id,
      p_question_id,
      p_chosen_index
    ) AS result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_answer(uuid, uuid, smallint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, uuid, smallint)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
