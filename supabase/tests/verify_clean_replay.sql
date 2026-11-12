do $$
declare
  v_atomic_rpc oid;
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.academic_terms') is null
     or to_regclass('public.class_meetings') is null
     or to_regclass('public.projects') is null
     or to_regclass('public.project_tasks') is null
     or to_regclass('public.project_documents') is null
     or to_regclass('public.project_activity') is null
     or to_regclass('private.question_keys') is null then
    raise exception 'A required AZ table is missing after clean migration replay';
  end if;

  if to_regprocedure('private.sweep_stuck_reservations(integer)') is null then
    raise exception 'Credit reservation sweep function is missing';
  end if;

  if to_regprocedure('public.reserve_credits(uuid,text,text,numeric)') is null
     or to_regprocedure('public.settle_credits(uuid,text,text,numeric,text,text,text,integer,text)') is null
     or to_regprocedure('public.refund_credits(uuid,text,text,text)') is null then
    raise exception 'Existing credit reservation lifecycle RPCs are missing';
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_usage_log' and column_name = 'request_payload_hash')
     or not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quiz_questions' and column_name = 'position_no') then
    raise exception 'Quiz idempotency/replay columns are missing';
  end if;

  if to_regprocedure('public.create_document_upload_record(uuid,uuid,text,text)') is null
     or to_regprocedure('private.enforce_document_page_limits()') is null
     or not exists (select 1 from pg_trigger
       where tgname = 'document_pages_enforce_usage_limits' and not tgisinternal) then
    raise exception 'Database-enforced document usage limit functions or trigger are missing';
  end if;

  if not has_function_privilege('service_role',
      'public.create_document_upload_record(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated',
      'public.create_document_upload_record(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('anon',
      'public.create_document_upload_record(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'Document upload reservation RPC grants are not service-role-only';
  end if;

  if to_regclass('public.user_rate_limit_counters') is null
     or to_regprocedure('public.consume_user_rate_limit(uuid,text)') is null then
    raise exception 'Database-backed user rate limit table or RPC is missing';
  end if;

  if not has_function_privilege('service_role',
      'public.consume_user_rate_limit(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated',
      'public.consume_user_rate_limit(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon',
      'public.consume_user_rate_limit(uuid,text)', 'EXECUTE') then
    raise exception 'User rate limit RPC grants are not service-role-only';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'completed_at'
  ) then
    raise exception 'tasks.completed_at is missing';
  end if;

  if to_regclass('public.azi_daily_challenge_completions') is null then
    raise exception 'AZI Daily Challenge completion table is missing';
  end if;

  if to_regprocedure('public.complete_daily_challenge(text,date,uuid,uuid,uuid)') is null then
    raise exception 'AZI Daily Challenge completion RPC is missing';
  end if;


  v_atomic_rpc := to_regprocedure('public.process_document_pages_atomic(text,uuid,uuid,timestamptz,jsonb,integer,text)');
  if v_atomic_rpc is null then
    raise exception 'Atomic document processing RPC is missing';
  end if;

  if not has_function_privilege('service_role', v_atomic_rpc, 'EXECUTE') then
    raise exception 'service_role cannot execute the atomic document processing RPC';
  end if;

  if has_function_privilege('authenticated', v_atomic_rpc, 'EXECUTE')
     or has_function_privilege('anon', v_atomic_rpc, 'EXECUTE') then
    raise exception 'The atomic document processing RPC is exposed to browser roles';
  end if;

  if (select prosecdef from pg_proc where oid = v_atomic_rpc) then
    raise exception 'The atomic document processing RPC must remain SECURITY INVOKER';
  end if;

  if (select count(*) from cron.job where jobname = 'sweep-stuck-reservations') <> 1 then
    raise exception 'Expected exactly one local cron schedule stub';
  end if;
end
$$;
