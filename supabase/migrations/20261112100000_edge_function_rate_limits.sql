-- DB-backed per-user Edge Function rate limits.
-- Owner-configured in app_config.edge_rate_limits; no rate values are hardcoded.
create table public.user_edge_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in (
    'create_document_upload_url',
    'create_document_signed_url',
    'process_document_pages',
    'process_document_pages_save_pages',
    'generate_quiz'
  )),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (user_id, endpoint)
);

alter table public.user_edge_rate_limits enable row level security;
revoke all on public.user_edge_rate_limits from public, anon, authenticated, service_role;

create function public.consume_edge_rate_limit(
  p_user_id uuid,
  p_endpoint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan text;
  v_config jsonb;
  v_max_requests integer;
  v_window_seconds integer;
  v_window_started timestamptz;
  v_request_count integer;
  v_now timestamptz := clock_timestamp();
  v_retry_after integer;
begin
  if p_user_id is null or p_endpoint not in (
    'create_document_upload_url',
    'create_document_signed_url',
    'process_document_pages',
    'process_document_pages_save_pages',
    'generate_quiz'
  ) then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_RATE_LIMIT_INPUT');
  end if;

  -- One lock serializes all endpoint counters for this user and prevents concurrent cap overruns.
  select p.plan into v_plan
    from public.profiles p
   where p.id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('allowed', false, 'code', 'USER_NOT_FOUND');
  end if;

  select c.value -> v_plan -> p_endpoint into v_config
    from public.app_config c
   where c.key = 'edge_rate_limits';
  if v_config is null
     or jsonb_typeof(v_config -> 'max_requests') is distinct from 'number'
     or jsonb_typeof(v_config -> 'window_seconds') is distinct from 'number' then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITS_NOT_CONFIGURED');
  end if;

  v_max_requests := (v_config ->> 'max_requests')::integer;
  v_window_seconds := (v_config ->> 'window_seconds')::integer;
  if v_max_requests < 1 or v_window_seconds < 1 then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITS_NOT_CONFIGURED');
  end if;

  select r.window_started_at, r.request_count
    into v_window_started, v_request_count
    from public.user_edge_rate_limits r
   where r.user_id = p_user_id and r.endpoint = p_endpoint
   for update;

  if not found then
    insert into public.user_edge_rate_limits(user_id, endpoint, window_started_at, request_count)
    values (p_user_id, p_endpoint, v_now, 1);
    return jsonb_build_object(
      'allowed', true,
      'remaining', v_max_requests - 1,
      'resetAt', v_now + make_interval(secs => v_window_seconds)
    );
  end if;

  if v_window_started + make_interval(secs => v_window_seconds) <= v_now then
    update public.user_edge_rate_limits
       set window_started_at = v_now, request_count = 1
     where user_id = p_user_id and endpoint = p_endpoint;
    return jsonb_build_object(
      'allowed', true,
      'remaining', v_max_requests - 1,
      'resetAt', v_now + make_interval(secs => v_window_seconds)
    );
  end if;

  if v_request_count >= v_max_requests then
    v_retry_after := greatest(1, ceil(extract(epoch from (
      v_window_started + make_interval(secs => v_window_seconds) - v_now
    )))::integer);
    return jsonb_build_object(
      'allowed', false,
      'code', 'RATE_LIMIT_EXCEEDED',
      'retryAfterSeconds', v_retry_after
    );
  end if;

  update public.user_edge_rate_limits
     set request_count = request_count + 1
   where user_id = p_user_id and endpoint = p_endpoint;
  return jsonb_build_object(
    'allowed', true,
    'remaining', v_max_requests - v_request_count - 1,
    'resetAt', v_window_started + make_interval(secs => v_window_seconds)
  );
end;
$function$;

revoke all on function public.consume_edge_rate_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(uuid, text) to service_role;
