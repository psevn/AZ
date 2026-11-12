#!/usr/bin/env bash
# Replays every committed migration against a disposable PostgreSQL database.
# This script must only receive a throwaway database URL; it never links to Supabase.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a throwaway local/test database}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -n "${PSQL_DOCKER_CONTAINER:-}" ]]; then
  psql_file() {
    docker exec -i "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -q -f - < "$1"
  }
  psql_command() {
    docker exec "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -q -c "$1"
  }
  psql_stdin() {
    docker exec -i "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -q
  }
else
  PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q)
  psql_file() { "${PSQL[@]}" -f "$1"; }
  psql_command() { "${PSQL[@]}" -c "$1"; }
  psql_stdin() { "${PSQL[@]}"; }
fi

psql_file "$ROOT/supabase/tests/clean_replay_stubs.sql"
psql_command "create publication supabase_realtime"

count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  echo "Replaying $name"
  if [[ "$name" == "20261105161922_schedule_sweep_stuck_reservations.sql" ]]; then
    # pg_cron is not installed in this disposable CI database. The migration's
    # scheduling calls still execute against the local cron.* test stub.
    sed '/^create extension if not exists pg_cron with schema pg_catalog;$/d' "$f" | psql_stdin
  else
    psql_file "$f"
  fi
  count=$((count + 1))
done

if [[ "$count" -ne 34 ]]; then
  echo "Expected 34 migrations, replayed $count" >&2
  exit 1
fi

psql_command "insert into public.app_config(key, value) values ('document_limits', '{\"free\":{\"max_documents\":1000,\"max_pending_uploads\":100,\"max_total_pages\":100000,\"max_total_text_chars\":100000000,\"max_pages_per_document\":1000,\"stale_uploaded_minutes\":180},\"pro\":{\"max_documents\":10000,\"max_pending_uploads\":1000,\"max_total_pages\":1000000,\"max_total_text_chars\":1000000000,\"max_pages_per_document\":1000,\"stale_uploaded_minutes\":180}}'::jsonb) on conflict (key) do update set value = excluded.value"
psql_file "$ROOT/supabase/tests/verify_clean_replay.sql"
psql_file "$ROOT/supabase/tests/verify_atomic_document_processing.sql"
psql_file "$ROOT/supabase/tests/verify_rls_isolation.sql"
psql_file "$ROOT/supabase/tests/verify_document_limits.sql"
bash "$ROOT/supabase/tests/run_quiz_credit_concurrency.sh"
echo "PASS: all migrations replayed; authenticated RLS, document limits, and concurrent quiz-credit checks passed on a disposable PostgreSQL database."
