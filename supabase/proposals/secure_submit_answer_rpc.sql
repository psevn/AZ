-- PROPOSAL ONLY — not applied to Supabase.
-- Hides the answer key from browser callers while preserving server-side grading.

create or replace function public.submit_answer_safe(
  p_attempt_id uuid,
  p_question_id uuid,
  p_chosen_index smallint
)
returns table(is_correct boolean, explanation text, answered_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    select result.is_correct, result.explanation, result.answered_at
      from private.submit_answer(p_attempt_id, p_question_id, p_chosen_index) as result;
end;
$function$;

-- Remove the key-bearing legacy entry point from browser roles.
revoke all on function public.submit_answer(uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function private.submit_answer(uuid, uuid, smallint) from public, anon, authenticated;

-- Only authenticated users may submit their own answers; auth.uid() is enforced
-- again by the underlying private.submit_answer implementation.
revoke all on function public.submit_answer_safe(uuid, uuid, smallint) from public, anon;
grant execute on function public.submit_answer_safe(uuid, uuid, smallint) to authenticated;
