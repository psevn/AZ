-- PROPOSAL ONLY — not applied to Supabase.
-- Apply in the same reviewed migration as create_generated_quiz_rpc.sql and
-- after 20261112080000_scaled_quiz_credit_reservations.sql.
-- Quiz persistence and credit settlement execute in one PostgreSQL transaction.

create function public.complete_generated_quiz(
  p_user_id uuid,
  p_document_id uuid,
  p_document_title text,
  p_request_key text,
  p_questions jsonb,
  p_actual_cost numeric,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer
)
returns table(quiz_id uuid, questions jsonb, result_payload jsonb)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_saved record;
  v_settlement record;
  v_payload jsonb;
begin
  if p_user_id is null or p_document_id is null
     or nullif(btrim(p_document_title), '') is null
     or p_request_key is null or btrim(p_request_key) = ''
     or p_actual_cost is null or p_actual_cost < 0
     or p_input_tokens is null or p_input_tokens < 0
     or p_output_tokens is null or p_output_tokens < 0 then
    raise exception 'Invalid quiz finalization input' using errcode = '22023';
  end if;

  -- Existing persistence RPC remains the single owner/shape/key validation boundary.
  select * into v_saved
    from public.create_generated_quiz(p_user_id, p_document_id, p_questions);
  if v_saved.quiz_id is null or v_saved.questions is null then
    raise exception 'Generated quiz persistence returned no result' using errcode = 'P0001';
  end if;

  v_payload := jsonb_build_object(
    'quizId', v_saved.quiz_id,
    'document', jsonb_build_object('id', p_document_id, 'title', btrim(p_document_title)),
    'questions', v_saved.questions,
    'questionCount', jsonb_array_length(v_saved.questions),
    'provider', p_provider,
    'model', p_model
  );

  -- Calls the existing settlement RPC inside this same transaction. If settlement
  -- fails, the exception rolls back quiz, questions, answer keys, and usage changes.
  select * into v_settlement
    from public.settle_quiz_generation(
      p_user_id,
      'generate_quiz',
      p_request_key,
      p_actual_cost,
      p_provider,
      p_model,
      p_prompt_version,
      p_latency_ms,
      v_saved.quiz_id::text,
      p_input_tokens,
      p_output_tokens,
      v_payload
    );

  if v_settlement.r_status is distinct from 'succeeded' then
    raise exception 'Quiz credit settlement did not succeed' using errcode = 'P0001';
  end if;

  return query select v_saved.quiz_id, v_saved.questions, v_payload;
end;
$function$;

revoke all on function public.complete_generated_quiz(
  uuid, uuid, text, text, jsonb, numeric, text, text, text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.complete_generated_quiz(
  uuid, uuid, text, text, jsonb, numeric, text, text, text, integer, integer, integer
) to service_role;
