-- Extend the existing credit reservation/settlement RPCs for scaled quiz generation.
-- Additive and review-only until a separately approved migration rollout.
alter table public.ai_usage_log
  add column result_payload jsonb,
  add constraint ai_usage_log_result_payload_object
    check (result_payload is null or jsonb_typeof(result_payload) = 'object');

create function private.reserve_credits(
  p_user_id uuid,
  p_feature text,
  p_request_key text,
  p_est_cost numeric,
  p_credit_multiplier numeric
)
returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_credits numeric;
  v_plan text;
  v_dl numeric := 0;
  v_ml numeric := 0;
  v_day date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_id uuid;
  v_used_d numeric; v_res_d numeric; v_used_m numeric; v_res_m numeric;
  v_sp_res numeric; v_sp_set numeric;
  v_cap numeric;
  v_reason text;
begin
  if p_user_id is null or p_feature is null or p_request_key is null or btrim(p_request_key) = ''
     or p_est_cost is null or p_est_cost < 0
     or p_credit_multiplier is null or p_credit_multiplier <= 0 or p_credit_multiplier > 10 then
    raise exception 'Invalid reserve input' using errcode = '22023';
  end if;

  select cc.credits * p_credit_multiplier into v_credits
    from public.credit_costs as cc where cc.feature = p_feature;
  if not found then raise exception 'Unknown feature' using errcode = 'P0002'; end if;
  select p.plan into v_plan from public.profiles as p where p.id = p_user_id;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  insert into public.ai_usage_log as l (user_id, feature, request_key, status)
  values (p_user_id, p_feature, p_request_key, 'reserved')
  on conflict (user_id, feature, request_key) do nothing
  returning l.id into v_id;

  if v_id is null then
    return query
      select x.status, x.error, true, x.credits_reserved
        from public.ai_usage_log as x
       where x.user_id = p_user_id and x.feature = p_feature and x.request_key = p_request_key;
    return;
  end if;

  select ul.daily_credits, ul.monthly_credits into v_dl, v_ml
    from public.usage_limits as ul where ul.plan = v_plan;
  if not found then v_dl := 0; v_ml := 0; end if;

  insert into public.usage_counters (user_id, period_type, period_start)
  values (p_user_id, 'day', v_day), (p_user_id, 'month', v_month)
  on conflict do nothing;
  insert into public.spend_counters (month) values (v_month) on conflict do nothing;

  select uc.credits_used, uc.credits_reserved into v_used_d, v_res_d
    from public.usage_counters as uc
   where uc.user_id = p_user_id and uc.period_type = 'day' and uc.period_start = v_day for update;
  select uc.credits_used, uc.credits_reserved into v_used_m, v_res_m
    from public.usage_counters as uc
   where uc.user_id = p_user_id and uc.period_type = 'month' and uc.period_start = v_month for update;
  select sc.reserved_cost, sc.settled_cost into v_sp_res, v_sp_set
    from public.spend_counters as sc where sc.month = v_month for update;

  select coalesce((select (c.value #>> '{}')::numeric from public.app_config as c
                    where c.key = 'global_monthly_cost_cap'), 0) into v_cap;

  if v_used_d + v_res_d + v_credits > v_dl then
    v_reason := 'daily_limit';
  elsif v_used_m + v_res_m + v_credits > v_ml then
    v_reason := 'monthly_limit';
  elsif v_cap <= 0 or v_sp_res + v_sp_set + p_est_cost > v_cap then
    v_reason := 'global_cap';
  end if;

  if v_reason is not null then
    update public.ai_usage_log as x
       set status = 'failed', error = 'denied:' || v_reason, updated_at = now()
     where x.id = v_id;
    return query select 'denied'::text, v_reason, false, 0::numeric;
    return;
  end if;

  update public.usage_counters as uc
     set credits_reserved = uc.credits_reserved + v_credits
   where uc.user_id = p_user_id
     and (uc.period_type, uc.period_start) in (('day', v_day), ('month', v_month));
  update public.spend_counters as sc
     set reserved_cost = sc.reserved_cost + p_est_cost where sc.month = v_month;
  update public.ai_usage_log as x
     set credits_reserved = v_credits, cost_reserved = p_est_cost, updated_at = now()
   where x.id = v_id;

  return query select 'reserved'::text, null::text, false, v_credits;
end;
$function$;

create function public.reserve_credits(
  p_user_id uuid,
  p_feature text,
  p_request_key text,
  p_est_cost numeric,
  p_credit_multiplier numeric
)
returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric)
language sql
set search_path = ''
as $function$
  select * from private.reserve_credits(p_user_id, p_feature, p_request_key, p_est_cost, p_credit_multiplier);
$function$;

create function public.settle_quiz_generation(
  p_user_id uuid,
  p_feature text,
  p_request_key text,
  p_actual_cost numeric,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_latency_ms integer,
  p_result_ref text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_result_payload jsonb
)
returns table(r_status text, r_replay boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_replay boolean;
begin
  if p_input_tokens is null or p_input_tokens < 0
     or p_output_tokens is null or p_output_tokens < 0
     or p_result_payload is null or jsonb_typeof(p_result_payload) is distinct from 'object' then
    raise exception 'Invalid quiz usage result' using errcode = '22023';
  end if;

  select s.r_status, s.r_replay into v_status, v_replay
    from private.settle_credits(
      p_user_id, p_feature, p_request_key, p_actual_cost,
      p_provider, p_model, p_prompt_version, p_latency_ms, p_result_ref
    ) as s;

  update public.ai_usage_log as l
     set input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         result_payload = p_result_payload,
         updated_at = now()
   where l.user_id = p_user_id
     and l.feature = p_feature
     and l.request_key = p_request_key
     and l.status = 'succeeded';

  return query select v_status, v_replay;
end;
$function$;

revoke execute on function private.reserve_credits(uuid, text, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.reserve_credits(uuid, text, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.settle_quiz_generation(uuid, text, text, numeric, text, text, text, integer, text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function private.reserve_credits(uuid, text, text, numeric, numeric) to service_role;
grant execute on function public.reserve_credits(uuid, text, text, numeric, numeric) to service_role;
grant execute on function public.settle_quiz_generation(uuid, text, text, numeric, text, text, text, integer, text, integer, integer, jsonb) to service_role;
