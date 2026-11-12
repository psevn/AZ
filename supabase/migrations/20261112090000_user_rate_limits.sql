-- Per-user request rate limits for the document and quiz Edge Functions.
-- Runtime values are owner-configured in app_config.request_rate_limits.

create table if not exists public.user_rate_limit_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in (
    'create_document_upload_url',
    'create_document_signed_url',
    'process_document_pages',
    'process_document_pages_save_pages',
    'generate_quiz'
  )),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, endpoint, window_start)
);

alter table public.user_rate_limit_counters enable row level security;
revoke all on public.user_rate_limit_counters from anon, authenticated;
grant all on public.user_rate_limit_counters to service_role;

create or replace function public.consume_user_rate_limit(
  p_user_id uuid,
  p_endpoint text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plan text;
  v_limits jsonb;
  v_endpoint_limits jsonb;
  v_window_seconds integer;
  v_max_requests integer;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_request_count integer;
  v_retry_after integer;
begin
  if p_user_id is null or p_endpoint is null or p_endpoint not in (
    'create_document_upload_url',
    'create_document_signed_url',
    'process_document_pages',
    'process_document_pages_save_pages',
    'generate_quiz'
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'RATE_LIMIT_INVALID_INPUT');
  end if;

  select p.plan into v_plan from public.profiles p where p.id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'RATE_LIMIT_PROFILE_MISSING');
  end if;

  select c.value -> v_plan into v_limits
    from public.app_config c where c.key = 'request_rate_limits';
  if v_limits is null or jsonb_typeof(v_limits) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'error_code', 'RATE_LIMIT_CONFIGURATION_MISSING');
  end if;

  v_endpoint_limits := v_limits -> p_endpoint;
  if v_endpoint_limits is null or jsonb_typeof(v_endpoint_limits) is distinct from 'object'
     or jsonb_typeof(v_endpoint_limits->'window_seconds') is distinct from 'number'
     or jsonb_typeof(v_endpoint_limits->'max_requests') is distinct from 'number' then
    return jsonb_build_object('ok', false, 'error_code', 'RATE_LIMIT_CONFIGURATION_MISSING');
  end if;

  v_window_seconds := (v_endpoint_limits->>'window_seconds')::integer;
  v_max_requests := (v_endpoint_limits->>'max_requests')::integer;
  if v_window_seconds < 1 or v_window_seconds > 86400 or v_max_requests < 1 or v_max_requests > 10000 then
    return jsonb_build_object('ok', false, 'error_code', 'RATE_LIMIT_CONFIGURATION_INVALID');
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds
  );

  -- Keep only the current user's recent buckets; the maximum configured window is one day.
  delete from public.user_rate_limit_counters c
   where c.user_id = p_user_id and c.window_start < v_now - interval '1 day';

  insert into public.user_rate_limit_counters(user_id, endpoint, window_start, request_count)
  values (p_user_id, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start) do update
    set request_count = public.user_rate_limit_counters.request_count + 1
    where public.user_rate_limit_counters.request_count < v_max_requests
  returning request_count into v_request_count;

  v_retry_after := greatest(1, ceil(extract(epoch from (
    v_window_start + make_interval(secs => v_window_seconds) - clock_timestamp()
  )))::integer);

  if v_request_count is null then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'RATE_LIMIT_EXCEEDED',
      'retry_after_seconds', v_retry_after,
      'limit', v_max_requests
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(0, v_max_requests - v_request_count),
    'retry_after_seconds', v_retry_after
  );
end;
$function$;

revoke all on function public.consume_user_rate_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_user_rate_limit(uuid, text) to service_role;
