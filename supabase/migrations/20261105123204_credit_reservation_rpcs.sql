-- M3 (APPLIED live 2026-11-05): atomic credit reservation / settlement / refund / sweep (SPEC §9).
-- Called ONLY by server code (Edge Functions with the service role) after the user's JWT was verified;
-- the verified user id is passed in explicitly. Clients cannot execute any of these.
--
-- Rules implemented:
--   * Idempotency: unique (user_id, feature, request_key); a repeated key returns the stored outcome (replay=true)
--     and never reserves twice. Concurrent duplicates serialise on the unique index.
--   * Reserve checks, in one transaction under row locks: per-user daily limit, per-user monthly limit,
--     global monthly spend cap. Fail-closed: a cap of 0 (the seeded default) denies everything.
--   * Settle: reserved -> succeeded, moves credits reserved->used and cost reserved->settled (actual cost).
--   * Refund: reserved -> refunded, releases the reservation. A settled request cannot be refunded.
--   * Sweep: refunds reservations older than app_config.max_reserved_age_minutes (stuck provider calls).
--   * Lock order is always: log row -> day counter -> month counter -> global spend row (no deadlocks).
--   * Periods are UTC (day = UTC date, month = first UTC day of month).
-- ai_usage_log is empty at this point (guard below).

do $guard$
begin
  if exists (select 1 from public.ai_usage_log) then
    raise exception 'ai_usage_log is not empty; aborting';
  end if;
end
$guard$;

alter table public.ai_usage_log
  add column cost_reserved numeric(14, 6) not null default 0 check (cost_reserved >= 0),
  add column cost_actual numeric(14, 6) check (cost_actual is null or cost_actual >= 0);
-- (client SELECT grant stays limited to the safe column list from M1; new columns are not exposed)

grant usage on schema private to service_role;

-- ------------------------------------------------------------------ release helper
-- Releases a still-reserved log row (used by refund and sweep). Caller must already hold the log row lock.
create function private._release_reservation(p_log_id uuid, p_new_status text, p_error text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  l record;
  v_day date;
  v_month date;
begin
  select * into l from public.ai_usage_log as x where x.id = p_log_id;
  v_day := (l.created_at at time zone 'utc')::date;
  v_month := date_trunc('month', l.created_at at time zone 'utc')::date;

  perform 1 from public.usage_counters as uc
   where uc.user_id = l.user_id and uc.period_type = 'day' and uc.period_start = v_day for update;
  perform 1 from public.usage_counters as uc
   where uc.user_id = l.user_id and uc.period_type = 'month' and uc.period_start = v_month for update;
  perform 1 from public.spend_counters as sc where sc.month = v_month for update;

  update public.usage_counters as uc
     set credits_reserved = greatest(0, uc.credits_reserved - l.credits_reserved)
   where uc.user_id = l.user_id and (uc.period_type, uc.period_start) in (('day', v_day), ('month', v_month));
  update public.spend_counters as sc
     set reserved_cost = greatest(0, sc.reserved_cost - l.cost_reserved)
   where sc.month = v_month;
  update public.ai_usage_log as x
     set status = p_new_status, error = p_error, credits_charged = 0, updated_at = now()
   where x.id = p_log_id;
end;
$function$;

-- ------------------------------------------------------------------ reserve
create function private.reserve_credits(p_user_id uuid, p_feature text, p_request_key text, p_est_cost numeric default 0)
 returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric)
 language plpgsql
 security definer
 set search_path to ''
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
     or p_est_cost is null or p_est_cost < 0 then
    raise exception 'Invalid reserve input' using errcode = '22023';
  end if;

  select cc.credits into v_credits from public.credit_costs as cc where cc.feature = p_feature;
  if not found then
    raise exception 'Unknown feature' using errcode = 'P0002';
  end if;
  select p.plan into v_plan from public.profiles as p where p.id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  -- idempotency gate: a concurrent duplicate waits here until the first transaction ends
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

  select ul.daily_credits, ul.monthly_credits into v_dl, v_ml from public.usage_limits as ul where ul.plan = v_plan;
  if not found then v_dl := 0; v_ml := 0; end if;  -- fail closed

  insert into public.usage_counters (user_id, period_type, period_start)
  values (p_user_id, 'day', v_day), (p_user_id, 'month', v_month)
  on conflict do nothing;
  insert into public.spend_counters (month) values (v_month) on conflict do nothing;

  select uc.credits_used, uc.credits_reserved into v_used_d, v_res_d from public.usage_counters as uc
   where uc.user_id = p_user_id and uc.period_type = 'day' and uc.period_start = v_day for update;
  select uc.credits_used, uc.credits_reserved into v_used_m, v_res_m from public.usage_counters as uc
   where uc.user_id = p_user_id and uc.period_type = 'month' and uc.period_start = v_month for update;
  select sc.reserved_cost, sc.settled_cost into v_sp_res, v_sp_set from public.spend_counters as sc
   where sc.month = v_month for update;

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
   where uc.user_id = p_user_id and (uc.period_type, uc.period_start) in (('day', v_day), ('month', v_month));
  update public.spend_counters as sc set reserved_cost = sc.reserved_cost + p_est_cost where sc.month = v_month;
  update public.ai_usage_log as x
     set credits_reserved = v_credits, cost_reserved = p_est_cost, updated_at = now()
   where x.id = v_id;

  return query select 'reserved'::text, null::text, false, v_credits;
end;
$function$;

-- ------------------------------------------------------------------ settle
create function private.settle_credits(p_user_id uuid, p_feature text, p_request_key text, p_actual_cost numeric,
  p_provider text default null, p_model text default null, p_prompt_version text default null,
  p_latency_ms integer default null, p_result_ref text default null)
 returns table(r_status text, r_replay boolean)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  l record;
  v_day date;
  v_month date;
begin
  if p_user_id is null or p_feature is null or p_request_key is null or p_actual_cost is null or p_actual_cost < 0 then
    raise exception 'Invalid settle input' using errcode = '22023';
  end if;

  select * into l from public.ai_usage_log as x
   where x.user_id = p_user_id and x.feature = p_feature and x.request_key = p_request_key for update;
  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if l.status = 'succeeded' then
    return query select 'succeeded'::text, true;
    return;
  end if;
  if l.status <> 'reserved' then
    raise exception 'Request is not in reserved state (%)', l.status using errcode = '55000';
  end if;

  v_day := (l.created_at at time zone 'utc')::date;
  v_month := date_trunc('month', l.created_at at time zone 'utc')::date;
  perform 1 from public.usage_counters as uc
   where uc.user_id = l.user_id and uc.period_type = 'day' and uc.period_start = v_day for update;
  perform 1 from public.usage_counters as uc
   where uc.user_id = l.user_id and uc.period_type = 'month' and uc.period_start = v_month for update;
  perform 1 from public.spend_counters as sc where sc.month = v_month for update;

  update public.usage_counters as uc
     set credits_reserved = greatest(0, uc.credits_reserved - l.credits_reserved),
         credits_used = uc.credits_used + l.credits_reserved
   where uc.user_id = l.user_id and (uc.period_type, uc.period_start) in (('day', v_day), ('month', v_month));
  update public.spend_counters as sc
     set reserved_cost = greatest(0, sc.reserved_cost - l.cost_reserved),
         settled_cost = sc.settled_cost + p_actual_cost
   where sc.month = v_month;
  update public.ai_usage_log as x
     set status = 'succeeded', credits_charged = l.credits_reserved, cost_actual = p_actual_cost,
         provider = coalesce(p_provider, x.provider), model = coalesce(p_model, x.model),
         prompt_version = coalesce(p_prompt_version, x.prompt_version),
         latency_ms = p_latency_ms, result_ref = p_result_ref, updated_at = now()
   where x.id = l.id;

  return query select 'succeeded'::text, false;
end;
$function$;

-- ------------------------------------------------------------------ refund
create function private.refund_credits(p_user_id uuid, p_feature text, p_request_key text, p_error text default null)
 returns table(r_status text, r_replay boolean)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  l record;
begin
  if p_user_id is null or p_feature is null or p_request_key is null then
    raise exception 'Invalid refund input' using errcode = '22023';
  end if;
  select * into l from public.ai_usage_log as x
   where x.user_id = p_user_id and x.feature = p_feature and x.request_key = p_request_key for update;
  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if l.status in ('refunded', 'failed') then
    return query select l.status, true;
    return;
  end if;
  if l.status = 'succeeded' then
    raise exception 'A settled request cannot be refunded' using errcode = '55000';
  end if;
  perform private._release_reservation(l.id, 'refunded', coalesce(p_error, 'refunded'));
  return query select 'refunded'::text, false;
end;
$function$;

-- ------------------------------------------------------------------ sweep
create function private.sweep_stuck_reservations(p_batch integer default 100)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_minutes numeric;
  r record;
  v_n integer := 0;
begin
  select coalesce((select (c.value #>> '{}')::numeric from public.app_config as c
                    where c.key = 'max_reserved_age_minutes'), 10) into v_minutes;
  for r in
    select x.id from public.ai_usage_log as x
     where x.status = 'reserved' and x.updated_at < now() - make_interval(secs => v_minutes * 60)
     order by x.updated_at
     limit greatest(1, least(coalesce(p_batch, 100), 1000))
     for update skip locked
  loop
    perform private._release_reservation(r.id, 'refunded', 'swept: reservation timed out');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

-- ------------------------------------------------- public wrappers (INVOKER) for PostgREST/Edge Functions
create function public.reserve_credits(p_user_id uuid, p_feature text, p_request_key text, p_est_cost numeric default 0)
 returns table(r_status text, r_reason text, r_replay boolean, r_credits numeric)
 language sql set search_path to ''
as $function$ select * from private.reserve_credits(p_user_id, p_feature, p_request_key, p_est_cost); $function$;

create function public.settle_credits(p_user_id uuid, p_feature text, p_request_key text, p_actual_cost numeric,
  p_provider text default null, p_model text default null, p_prompt_version text default null,
  p_latency_ms integer default null, p_result_ref text default null)
 returns table(r_status text, r_replay boolean)
 language sql set search_path to ''
as $function$ select * from private.settle_credits(p_user_id, p_feature, p_request_key, p_actual_cost,
  p_provider, p_model, p_prompt_version, p_latency_ms, p_result_ref); $function$;

create function public.refund_credits(p_user_id uuid, p_feature text, p_request_key text, p_error text default null)
 returns table(r_status text, r_replay boolean)
 language sql set search_path to ''
as $function$ select * from private.refund_credits(p_user_id, p_feature, p_request_key, p_error); $function$;

create function public.sweep_stuck_reservations(p_batch integer default 100)
 returns integer
 language sql set search_path to ''
as $function$ select private.sweep_stuck_reservations(p_batch); $function$;

-- ------------------------------------------------------------ grants: server (service_role) only
revoke execute on function
  private._release_reservation(uuid, text, text),
  private.reserve_credits(uuid, text, text, numeric),
  private.settle_credits(uuid, text, text, numeric, text, text, text, integer, text),
  private.refund_credits(uuid, text, text, text),
  private.sweep_stuck_reservations(integer),
  public.reserve_credits(uuid, text, text, numeric),
  public.settle_credits(uuid, text, text, numeric, text, text, text, integer, text),
  public.refund_credits(uuid, text, text, text),
  public.sweep_stuck_reservations(integer)
  from public, anon, authenticated;

grant execute on function
  private.reserve_credits(uuid, text, text, numeric),
  private.settle_credits(uuid, text, text, numeric, text, text, text, integer, text),
  private.refund_credits(uuid, text, text, text),
  private.sweep_stuck_reservations(integer),
  public.reserve_credits(uuid, text, text, numeric),
  public.settle_credits(uuid, text, text, numeric, text, text, text, integer, text),
  public.refund_credits(uuid, text, text, text),
  public.sweep_stuck_reservations(integer)
  to service_role;
-- private._release_reservation stays callable only by its owner/other definer functions.
revoke execute on function private._release_reservation(uuid, text, text) from service_role;
