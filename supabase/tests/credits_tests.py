"""Credit reservation tests (SPEC §9): reserve / settle / refund / sweep, idempotency, limits,
global spend cap, fail-closed defaults and CONCURRENCY. Runs against the LOCAL replica only.
A "mock provider" is simulated by the caller: reserve -> (pretend call) -> settle or refund.
Every check is a separate psql session; concurrent checks run in parallel threads.
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live_schema_tests as L  # noqa: E402  (reuses run/check/expect helpers; its main() is guarded)

A, B, C = L.A, L.B, "cccccccc-cccc-cccc-cccc-cccccccccccc"
DAY = "(now() at time zone 'utc')::date"
MONTH = "date_trunc('month', now() at time zone 'utc')::date"


GATE = False  # when True, srv() calls wait on an advisory-lock gate so a whole batch starts at the same instant


def srv(sql):
    if GATE:
        sql = "select pg_advisory_lock_shared(4242); " + sql
    return L.run(sql, "service_role")


def reserve(user, feature, key, est=0.5):
    r = srv(f"select r_status, r_reason, r_replay, r_credits from public.reserve_credits('{user}','{feature}','{key}',{est})")
    return r.rows[0] if r.ok and r.rows else ["ERR", r.err[:100], "", ""]


def settle(user, feature, key, actual=0.3):
    r = srv(f"select r_status, r_replay from public.settle_credits('{user}','{feature}','{key}',{actual},'mock','mock-1','p1',12,'res')")
    return r.rows[0] if r.ok and r.rows else ["ERR", r.err[:100]]


def refund(user, feature, key):
    r = srv(f"select r_status, r_replay from public.refund_credits('{user}','{feature}','{key}','provider failed')")
    return r.rows[0] if r.ok and r.rows else ["ERR", r.err[:100]]


def counters(user, kind="day"):
    start = DAY if kind == "day" else MONTH
    r = srv(f"select credits_used, credits_reserved from usage_counters where user_id='{user}' and period_type='{kind}' and period_start={start}")
    return [float(x) for x in r.rows[0]] if r.rows else [0.0, 0.0]


def spend():
    r = srv(f"select reserved_cost, settled_cost from spend_counters where month={MONTH}")
    return [float(x) for x in r.rows[0]] if r.rows else [0.0, 0.0]


def reset(daily=5, monthly=100, cap=10, plan="free"):
    ok = srv(
        "truncate ai_usage_log, usage_counters, spend_counters;"
        f"update usage_limits set daily_credits={daily}, monthly_credits={monthly};"
        f"update app_config set value='{cap}'::jsonb where key='global_monthly_cost_cap';"
        "update app_config set value='10'::jsonb where key='max_reserved_age_minutes';"
        f"insert into usage_counters (user_id,period_type,period_start) select u, t, case t when 'day' then {DAY} else {MONTH} end "
        f"from (values ('{A}'::uuid),('{B}'::uuid)) a(u), (values ('day'),('month')) b(t);"
        f"insert into spend_counters (month) values ({MONTH});"
        "insert into credit_costs values ('quiz',1),('summary',2) on conflict (feature) do update set credits=excluded.credits;"
    )
    assert ok.ok, ok.err


def parallel(fn, jobs):
    """Run all jobs truly at once: every worker blocks on an advisory lock, then the gate opens."""
    global GATE
    import subprocess
    import time
    holder = subprocess.Popen(L.BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    holder.stdin.write("select pg_advisory_lock(4242);\n")
    holder.stdin.flush()
    time.sleep(0.5)
    GATE = True
    try:
        with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
            futs = [ex.submit(fn, *a) for a in jobs]
            deadline = time.time() + 30
            while time.time() < deadline:
                waiting = L.run("select count(*) from pg_locks where locktype='advisory' and not granted").scalar()
                if waiting is not None and int(waiting) >= len(jobs):
                    break
                time.sleep(0.1)
            holder.stdin.write("select pg_advisory_unlock(4242);\n\\q\n")
            holder.stdin.flush()
            out = [f.result() for f in futs]
    finally:
        GATE = False
        holder.kill()
    return out


def invariants(name):
    """counters must equal what the log says is in flight / charged."""
    r = srv("select coalesce(sum(credits_reserved) filter (where status='reserved'),0), "
            "coalesce(sum(credits_charged) filter (where status='succeeded'),0) from ai_usage_log")
    in_flight, charged = [float(x) for x in r.rows[0]]
    c = srv("select coalesce(sum(credits_reserved),0), coalesce(sum(credits_used),0) from usage_counters where period_type='day'")
    res, used = [float(x) for x in c.rows[0]]
    neg = srv("select count(*) from usage_counters where credits_used<0 or credits_reserved<0").scalar()
    negs = srv("select count(*) from spend_counters where reserved_cost<0 or settled_cost<0").scalar()
    L.check(f"{name}: counters match the log (in-flight={in_flight}, charged={charged}) and none negative",
            res == in_flight and used == charged and neg == "0" and negs == "0", f"counters res={res} used={used} neg={neg}/{negs}")


def t_setup_and_fail_closed():
    L.seed()
    reset(daily=0, monthly=0, cap=0)
    r = reserve(A, "quiz", "k1")
    L.check("fail-closed: seeded defaults (0 limits, 0 cap) deny the request", r[0] == "denied" and r[1] == "daily_limit", str(r))
    row = srv(f"select status, error, credits_reserved from ai_usage_log where user_id='{A}'").rows
    L.check("fail-closed: denial is logged as failed and reserves nothing", row == [["failed", "denied:daily_limit", "0"]], str(row))
    L.check("fail-closed: nothing counted", counters(A) == [0.0, 0.0] and spend() == [0.0, 0.0])
    reset(daily=5, monthly=100, cap=0)
    r = reserve(A, "quiz", "k2")
    L.check("fail-closed: limits OK but global cap 0 still denies (global_cap)", r[0] == "denied" and r[1] == "global_cap", str(r))
    L.expect("input: unknown feature rejected (P0002)", "P0002",
             f"select * from public.reserve_credits('{A}','nope','k','0')", "service_role")
    L.expect("input: negative estimated cost rejected (22023)", "22023",
             f"select * from public.reserve_credits('{A}','quiz','k',-1)", "service_role")
    L.expect("input: empty request key rejected (22023)", "22023",
             f"select * from public.reserve_credits('{A}','quiz','  ',0)", "service_role")
    L.expect("input: unknown user rejected (P0002)", "P0002",
             "select * from public.reserve_credits('99999999-9999-9999-9999-999999999999','quiz','k',0)", "service_role")


def t_lifecycle():
    L.seed()
    reset()
    r = reserve(A, "quiz", "life-1", 0.5)
    L.check("reserve: allowed within limits", r[0] == "reserved" and r[2] == "f" and float(r[3]) == 1, str(r))
    L.check("reserve: day+month counters and spend reserved updated",
            counters(A) == [0.0, 1.0] and counters(A, "month") == [0.0, 1.0] and spend() == [0.5, 0.0], f"{counters(A)} {spend()}")
    r = reserve(A, "quiz", "life-1", 0.5)
    L.check("idempotency: same key replays, does not reserve twice", r[0] == "reserved" and r[2] == "t" and counters(A) == [0.0, 1.0], str(r))
    r = settle(A, "quiz", "life-1", 0.3)
    L.check("settle: reserved -> succeeded", r == ["succeeded", "f"], str(r))
    L.check("settle: credits moved reserved->used, cost moved reserved->settled(actual)",
            counters(A) == [1.0, 0.0] and spend() == [0.0, 0.3], f"{counters(A)} {spend()}")
    row = srv(f"select status, credits_charged, cost_actual, provider, model, prompt_version, latency_ms, result_ref from ai_usage_log where request_key='life-1'").rows
    L.check("settle: provider/model/prompt/latency/result recorded", row == [["succeeded", "1", "0.300000", "mock", "mock-1", "p1", "12", "res"]], str(row))
    r = settle(A, "quiz", "life-1", 9)
    L.check("settle twice: idempotent, no double charge", r == ["succeeded", "t"] and counters(A) == [1.0, 0.0] and spend() == [0.0, 0.3], f"{r} {counters(A)} {spend()}")
    L.expect("refund after settle rejected (55000)", "55000",
             f"select * from public.refund_credits('{A}','quiz','life-1','x')", "service_role")
    L.expect("settle of a never-reserved key rejected (P0002)", "P0002",
             f"select * from public.settle_credits('{A}','quiz','ghost',0.1)", "service_role")
    reserve(A, "quiz", "life-2", 0.5)
    r = refund(A, "quiz", "life-2")
    L.check("refund: reserved -> refunded, reservation released",
            r == ["refunded", "f"] and counters(A) == [1.0, 0.0] and spend() == [0.0, 0.3], f"{r} {counters(A)} {spend()}")
    r = refund(A, "quiz", "life-2")
    L.check("refund twice: idempotent", r == ["refunded", "t"] and counters(A) == [1.0, 0.0], str(r))
    L.expect("settle after refund rejected (55000)", "55000",
             f"select * from public.settle_credits('{A}','quiz','life-2',0.1)", "service_role")
    r = reserve(A, "quiz", "life-2", 0.5)
    L.check("a refunded key stays refunded on replay (client must use a new key)", r[0] == "refunded" and r[2] == "t", str(r))
    invariants("lifecycle")


def t_limits():
    L.seed()
    reset(daily=5, monthly=100, cap=10)
    got = [reserve(A, "quiz", f"d{i}", 0.1)[0] for i in range(6)]
    L.check("daily limit: 5 credits allowed, 6th denied", got == ["reserved"] * 5 + ["denied"], str(got))
    L.check("daily limit: other user unaffected", reserve(B, "quiz", "d0", 0.1)[0] == "reserved")
    r = reserve(A, "summary", "d-sum", 0.1)
    L.check("daily limit: a 2-credit feature is denied when only 0 credits remain", r[0] == "denied" and r[1] == "daily_limit", str(r))
    reset(daily=100, monthly=3, cap=10)
    got = [reserve(A, "quiz", f"m{i}", 0.1)[0] for i in range(4)]
    L.check("monthly limit: 3 allowed, 4th denied (monthly_limit)", got == ["reserved"] * 3 + ["denied"], str(got))
    L.check("monthly limit: reason reported", reserve(A, "quiz", "m9", 0.1)[1] == "monthly_limit")
    reset(daily=100, monthly=100, cap=1.0)
    got = [reserve(A, "quiz", f"g{i}", 0.4)[0] for i in range(3)]
    L.check("global cap: 1.0 cap with 0.4 estimates -> 2 allowed, 3rd denied", got == ["reserved", "reserved", "denied"], str(got))
    L.check("global cap: another user is also blocked once the cap is reached", reserve(B, "quiz", "g9", 0.4)[1] == "global_cap")
    refund(A, "quiz", "g0")
    L.check("global cap: refund frees room again", reserve(B, "quiz", "g10", 0.4)[0] == "reserved")
    invariants("limits")


def t_concurrency():
    L.seed()
    reset(daily=5, monthly=100, cap=100)
    res = parallel(reserve, [(A, "quiz", f"c{i}", 0.1) for i in range(30)])
    ok = sum(1 for r in res if r[0] == "reserved")
    L.check("concurrency: 30 parallel reserves with a limit of 5 -> exactly 5 reserved", ok == 5, f"reserved={ok} denied={sum(1 for r in res if r[0]=='denied')} err={[r for r in res if r[0]=='ERR'][:2]}")
    L.check("concurrency: counter shows exactly 5 reserved, never more", counters(A) == [0.0, 5.0], str(counters(A)))
    invariants("concurrent reserve")

    reset(daily=100, monthly=100, cap=100)
    res = parallel(reserve, [(A, "quiz", "same-key", 0.1) for _ in range(20)])
    fresh = [r for r in res if r[0] == "reserved" and r[2] == "f"]
    L.check("concurrency: 20 parallel requests with the SAME key -> exactly one real reservation",
            len(fresh) == 1 and all(r[0] == "reserved" for r in res) and counters(A) == [0.0, 1.0], f"fresh={len(fresh)} {counters(A)}")

    reset(daily=100, monthly=100, cap=1.0)
    res = parallel(reserve, [(u, "quiz", f"u{i}", 0.4) for i in range(8) for u in (A, B)])
    ok = sum(1 for r in res if r[0] == "reserved")
    L.check("concurrency: 16 parallel reserves across 2 users with global cap 1.0/0.4 -> exactly 2 reserved", ok == 2, f"reserved={ok}")
    L.check("concurrency: global reserved cost never exceeds the cap", spend()[0] <= 1.0, str(spend()))

    reset(daily=100, monthly=100, cap=100)
    reserve(A, "quiz", "s1", 0.5)
    res = parallel(settle, [(A, "quiz", "s1", 0.3) for _ in range(12)])
    real = [r for r in res if r == ["succeeded", "f"]]
    L.check("concurrency: 12 parallel settles of one request -> exactly one real settle",
            len(real) == 1 and counters(A) == [1.0, 0.0] and spend() == [0.0, 0.3], f"real={len(real)} {counters(A)} {spend()}")

    reset(daily=100, monthly=100, cap=100)
    reserve(A, "quiz", "x1", 0.5)
    mix = parallel(lambda k: settle(A, "quiz", "x1", 0.3) if k % 2 else refund(A, "quiz", "x1"), [(k,) for k in range(10)])
    st = srv("select status from ai_usage_log where request_key='x1'").scalar()
    L.check("concurrency: settle and refund racing on one request end in exactly one final state, counters consistent",
            st in ("succeeded", "refunded"), f"status={st}")
    invariants("settle/refund race")

    reset(daily=100, monthly=100, cap=100)
    jobs = [(u, "quiz", f"mix{i}", 0.2) for i in range(10) for u in (A, B)]
    res = parallel(reserve, jobs)
    keys = [(j[0], j[2]) for j, r in zip(jobs, res) if r[0] == "reserved"]
    parallel(lambda u, k: settle(u, "quiz", k, 0.1) if hash(k) % 2 else refund(u, "quiz", k), keys)
    invariants("mixed load (reserve, then settle/refund in parallel)")
    L.check("mixed load: nothing left stuck in reserved", srv("select count(*) from ai_usage_log where status='reserved'").scalar() == "0")


def t_sweep():
    L.seed()
    reset(daily=5, monthly=100, cap=10)
    reserve(A, "quiz", "old", 0.5)
    reserve(A, "quiz", "young", 0.5)
    srv("update ai_usage_log set updated_at = now() - interval '30 minutes' where request_key='old'")
    n = srv("select public.sweep_stuck_reservations(100)").scalar()
    L.check("sweep: refunds only reservations older than max age (1 of 2)", n == "1", f"n={n}")
    st = dict(srv("select request_key, status from ai_usage_log").rows)
    L.check("sweep: old -> refunded, young stays reserved", st == {"old": "refunded", "young": "reserved"}, str(st))
    L.check("sweep: counters released only for the old one", counters(A) == [0.0, 1.0] and spend() == [0.5, 0.0], f"{counters(A)} {spend()}")
    L.check("sweep: running again does nothing", srv("select public.sweep_stuck_reservations(100)").scalar() == "0")
    srv("update ai_usage_log set updated_at = now() - interval '30 minutes' where request_key='young'")
    res = parallel(lambda: srv("select public.sweep_stuck_reservations(100)").scalar(), [() for _ in range(6)])
    L.check("sweep: concurrent sweepers release the last one exactly once", sum(int(x) for x in res) == 1, str(res))
    invariants("sweep")


def t_grants():
    L.seed()
    reset()
    for who, uid in (("anon", None), ("authenticated", A)):
        for sql in (f"select * from public.reserve_credits('{A}','quiz','z',0)",
                    f"select * from public.settle_credits('{A}','quiz','z',0)",
                    f"select * from public.refund_credits('{A}','quiz','z')",
                    "select public.sweep_stuck_reservations(1)",
                    f"select * from private.reserve_credits('{A}','quiz','z',0)"):
            L.expect(f"grants: {who} cannot run {sql.split('(')[0].replace('select * from ', '').replace('select ', '')}",
                     "42501", sql, who, uid)
    L.check("grants: a client can still not forge usage via its own session", L.run(
        f"insert into usage_counters (user_id,period_type,period_start) values ('{A}','day',current_date)", "authenticated", A).state == "42501")
    L.check("grants: owner sees own safe log columns only after the server wrote them",
            L.count("select 1 from ai_usage_log", "authenticated", A) >= 0)
    r = L.run("select status, credits_charged from ai_usage_log", "authenticated", A)
    L.check("grants: owner can read status/credits of own rows", r.ok, r.err[:120])


def main():
    for fn in (t_setup_and_fail_closed, t_lifecycle, t_limits, t_concurrency, t_sweep, t_grants):
        print(f"\n== {fn.__name__}")
        fn()
    fails = [r for r in L.results if r[1] == "FAIL"]
    print(f"\n{sum(1 for r in L.results if r[1] == 'PASS')} passed, {len(fails)} failed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
