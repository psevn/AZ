alter table public.quiz_questions
  add column position_no integer check (position_no is null or position_no >= 1);

create unique index quiz_questions_quiz_position_key
  on public.quiz_questions (quiz_id, position_no)
  where position_no is not null;

-- Proposal migration: dynamic, idempotent quiz credit reservation.
-- This extends the existing reservation lifecycle; settle_credits/refund_credits remain authoritative.
-- Requires explicit credit_costs rows: generate_quiz_base, generate_quiz_per_question,
-- and generate_quiz_per_page. No price is embedded in application code.

create or replace function private.reserve_quiz_credits(
  p_user_id uuid,
  p_request_key text,
  p_question_count integer,
  p_page_count integer,
  p_est_cost numeric
)
returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric, r_result_ref text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan text;
  v_base numeric;
  v_per_question numeric;
  v_per_page numeric;
  v_credits numeric;
  v_daily numeric;
  v_monthly numeric;
  v_day date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_used_day numeric;
  v_reserved_day numeric;
  v_used_month numeric;
  v_reserved_month numeric;
  v_spend_reserved numeric;
  v_spend_settled numeric;
  v_global_cap numeric;
  v_reason text;
  v_id uuid;
  v_existing record;
begin
  if p_user_id is null or p_request_key is null or btrim(p_request_key) = ''
     or p_question_count not between 5 and 20
     or p_page_count not between 1 and 40
     or p_est_cost is null or p_est_cost < 0 then
    raise exception 'Invalid quiz reservation input' using errcode = '22023';
  end if;

  select p.plan into v_plan from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select cc.credits into v_base from public.credit_costs cc where cc.feature = 'generate_quiz_base';
  if not found then raise exception 'Missing credit_costs.generate_quiz_base configuration' using errcode = 'P0002'; end if;
  select cc.credits into v_per_question from public.credit_costs cc where cc.feature = 'generate_quiz_per_question';
  if not found then raise exception 'Missing credit_costs.generate_quiz_per_question configuration' using errcode = 'P0002'; end if;
  select cc.credits into v_per_page from public.credit_costs cc where cc.feature = 'generate_quiz_per_page';
  if not found then raise exception 'Missing credit_costs.generate_quiz_per_page configuration' using errcode = 'P0002'; end if;
  v_credits := v_base + (v_per_question * p_question_count) + (v_per_page * p_page_count);

  insert into public.ai_usage_log(user_id, feature, request_key, status)
  values (p_user_id, 'generate_quiz', p_request_key, 'reserved')
  on conflict (user_id, feature, request_key) do nothing
  returning id into v_id;

  if v_id is null then
    select x.status, x.error, x.credits_reserved, x.result_ref
      into v_existing
      from public.ai_usage_log x
     where x.user_id = p_user_id and x.feature = 'generate_quiz' and x.request_key = p_request_key;
    return query select v_existing.status, v_existing.error, true,
                        coalesce(v_existing.credits_reserved, 0), v_existing.result_ref;
    return;
  end if;

  select ul.daily_credits, ul.monthly_credits
    into v_daily, v_monthly
    from public.usage_limits ul where ul.plan = v_plan;
  if not found then
    update public.ai_usage_log set status = 'failed', error = 'denied:missing_usage_limits', updated_at = now() where id = v_id;
    return query select 'denied'::text, 'missing_usage_limits'::text, false, 0::numeric, null::text;
    return;
  end if;

  insert into public.usage_counters(user_id, period_type, period_start)
  values (p_user_id, 'day', v_day), (p_user_id, 'month', v_month)
  on conflict do nothing;
  insert into public.spend_counters(month) values (v_month) on conflict do nothing;

  select uc.credits_used, uc.credits_reserved into v_used_day, v_reserved_day
    from public.usage_counters uc
   where uc.user_id = p_user_id and uc.period_type = 'day' and uc.period_start = v_day for update;
  select uc.credits_used, uc.credits_reserved into v_used_month, v_reserved_month
    from public.usage_counters uc
   where uc.user_id = p_user_id and uc.period_type = 'month' and uc.period_start = v_month for update;
  select sc.reserved_cost, sc.settled_cost into v_spend_reserved, v_spend_settled
    from public.spend_counters sc where sc.month = v_month for update;
  select coalesce((select (c.value #>> '{}')::numeric from public.app_config c
                    where c.key = 'global_monthly_cost_cap'), 0)
    into v_global_cap;

  if v_used_day + v_reserved_day + v_credits > v_daily then
    v_reason := 'daily_limit';
  elsif v_used_month + v_reserved_month + v_credits > v_monthly then
    v_reason := 'monthly_limit';
  elsif v_global_cap <= 0 or v_spend_reserved + v_spend_settled + p_est_cost > v_global_cap then
    v_reason := 'global_cap';
  end if;

  if v_reason is not null then
    update public.ai_usage_log set status = 'failed', error = 'denied:' || v_reason, updated_at = now() where id = v_id;
    return query select 'denied'::text, v_reason, false, 0::numeric, null::text;
    return;
  end if;

  update public.usage_counters
     set credits_reserved = credits_reserved + v_credits
   where user_id = p_user_id and (period_type, period_start) in (('day', v_day), ('month', v_month));
  update public.spend_counters set reserved_cost = reserved_cost + p_est_cost where month = v_month;
  update public.ai_usage_log
     set credits_reserved = v_credits, cost_reserved = p_est_cost, updated_at = now()
   where id = v_id;

  return query select 'reserved'::text, null::text, false, v_credits, null::text;
end;
$function$;

create or replace function public.reserve_quiz_credits(
  p_user_id uuid, p_request_key text, p_question_count integer, p_page_count integer, p_est_cost numeric
)
returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric, r_result_ref text)
language sql
set search_path = ''
as $function$
  select * from private.reserve_quiz_credits(p_user_id, p_request_key, p_question_count, p_page_count, p_est_cost);
$function$;

revoke execute on function private.reserve_quiz_credits(uuid, text, integer, integer, numeric),
  public.reserve_quiz_credits(uuid, text, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function private.reserve_quiz_credits(uuid, text, integer, integer, numeric),
  public.reserve_quiz_credits(uuid, text, integer, integer, numeric)
  to service_role;
