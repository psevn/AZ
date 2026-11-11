#!/usr/bin/env bash
# Replays every committed migration against a disposable PostgreSQL database.
# This script must only receive a throwaway database URL; it never links to Supabase.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a throwaway local/test database}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/clean_replay_stubs.sql"
"${PSQL[@]}" -c "create publication supabase_realtime"

count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  echo "Replaying $name"
  if [[ "$name" == "20261105161922_schedule_sweep_stuck_reservations.sql" ]]; then
    # pg_cron is not installed in this disposable CI database. The migration's
    # scheduling calls still execute against the local cron.* test stub.
    sed '/^create extension if not exists pg_cron with schema pg_catalog;$/d' "$f" | "${PSQL[@]}"
  else
    "${PSQL[@]}" -f "$f"
  fi
  count=$((count + 1))
done

if [[ "$count" -ne 31 ]]; then
  echo "Expected 31 migrations, replayed $count" >&2
  exit 1
fi

"${PSQL[@]}" -f "$ROOT/supabase/tests/verify_clean_replay.sql"
echo "PASS: all 31 migrations replayed on a disposable empty PostgreSQL database."
