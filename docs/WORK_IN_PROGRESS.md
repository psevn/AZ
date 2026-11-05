# Work in progress

One line per active task. Add before starting, remove when merged. See `COLLABORATION.md`.

| Agent | Area / files | Branch | Since | Status |
|---|---|---|---|---|
| Claude | `supabase/baseline/`, `supabase/tests/`, `supabase/proposed/`, `docs/COLLABORATION.md`, `docs/reports/` | `audit/live-schema-tests` | 2026-11-05 | PR open, awaiting PSEVN |

## Claude — database (2026-11-05 15:30)
Done: migrations 20261105122212 and 20261105122304 applied live and tested (see docs/reports/2026-11-05-live-schema-audit.md).
Next: credit RPCs (reserve/settle/refund/sweep) with concurrency tests; server-signed upload Edge Functions; account-deletion Storage cleanup. Area owner: Claude (supabase/). ChatGPT: web UI/docs outside supabase/.

## Claude — database (2026-11-05 16:00)
Done: credit RPCs (M3) applied live + 61 concurrency/limit tests. Next: signed-upload Edge Functions, account-deletion Storage cleanup. Open question for PSEVN: should the daily limit reset at midnight Qatar time (UTC+3) instead of UTC?
