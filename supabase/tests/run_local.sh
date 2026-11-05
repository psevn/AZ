#!/usr/bin/env bash
# Builds a THROWAWAY local Postgres from the live-schema snapshot and runs the
# audit tests. It never connects to the real Supabase project.
# Needs: PostgreSQL server binaries + python3 (no extra Python packages).
# Usage (Linux, as root): bash supabase/tests/run_local.sh
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/lib/postgresql/az-test}"
PORT=54329
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SNAPSHOT="${SNAPSHOT:-$ROOT/supabase/baseline/live_schema_snapshot_2026-11-05.sql}"

as_pg() { runuser -u postgres -- "$@"; }

if [ ! -d "$PGDATA" ]; then
  as_pg "$PGBIN/initdb" -D "$PGDATA" --auth=trust -U postgres >/dev/null
fi
as_pg "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" -l "$PGDATA/log.txt" -w start >/dev/null
trap 'as_pg "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null' EXIT

PSQL=(psql -X -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "drop database if exists az_test" -c "create database az_test"
# roles are cluster-wide: remove leftovers from a previous run
"${PSQL[@]}" -d postgres <<'SQL' >/dev/null 2>&1 || true
drop owned by anon cascade; drop owned by authenticated cascade; drop owned by service_role cascade;
SQL
"${PSQL[@]}" -d postgres -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" >/dev/null 2>&1 || true

"${PSQL[@]}" -d az_test -f "$HERE/local_stubs.sql"
"${PSQL[@]}" -d az_test -f "$SNAPSHOT"
# The snapshot is the live state as of 2026-11-05 morning. Replay what was applied after it.
for f in "$ROOT"/supabase/migrations/20261105*.sql; do
  [ -e "$f" ] || continue
  echo "applying live migration $(basename "$f")"
  "${PSQL[@]}" -d az_test -f "$f"
done
# SKIP_PROPOSED=1 tests the live schema exactly as it is today (no proposed fixes).
for f in "$ROOT"/supabase/proposed/*.sql; do
  [ -e "$f" ] || continue
  [ "${SKIP_PROPOSED:-0}" = "1" ] && continue
  echo "applying proposed (NOT live) $(basename "$f")"
  "${PSQL[@]}" -d az_test -f "$f"
done

AZ_PG_PORT=$PORT python3 -I "$HERE/live_schema_tests.py"
AZ_PG_PORT=$PORT python3 -I "$HERE/credits_tests.py"
