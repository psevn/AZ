#!/usr/bin/env bash
# Disposable PostgreSQL concurrency checks for per-user Edge Function rate limits.
set -euo pipefail

if [[ -n "${PSQL_DOCKER_CONTAINER:-}" ]]; then
  psql_run() {
    docker exec "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -At -c "$1"
  }
else
  : "${DATABASE_URL:?Set DATABASE_URL to a disposable local PostgreSQL database}"
  psql_run() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$1"; }
fi

USER_ID="a3333333-3333-4333-8333-333333333333"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

psql_run "insert into auth.users(id,email) values ('$USER_ID','rate-limit-test@example.invalid') on conflict (id) do nothing;
  insert into public.profiles(id,plan) values ('$USER_ID','free')
  on conflict (id) do update set plan='free';
  insert into public.app_config(key,value) values (
    'edge_rate_limits',
    '{\"free\":{
      \"create_document_upload_url\":{\"max_requests\":3,\"window_seconds\":60},
      \"create_document_signed_url\":{\"max_requests\":3,\"window_seconds\":60},
      \"process_document_pages\":{\"max_requests\":3,\"window_seconds\":60},
      \"process_document_pages_save_pages\":{\"max_requests\":3,\"window_seconds\":60},
      \"generate_quiz\":{\"max_requests\":3,\"window_seconds\":60}},
      \"pro\":{
      \"create_document_upload_url\":{\"max_requests\":3,\"window_seconds\":60},
      \"create_document_signed_url\":{\"max_requests\":3,\"window_seconds\":60},
      \"process_document_pages\":{\"max_requests\":3,\"window_seconds\":60},
      \"process_document_pages_save_pages\":{\"max_requests\":3,\"window_seconds\":60},
      \"generate_quiz\":{\"max_requests\":3,\"window_seconds\":60}}}'::jsonb
  ) on conflict (key) do update set value=excluded.value;"

# Concurrent requests must be serialized by the user's profile lock.
for n in 1 2 3 4 5 6 7 8; do
  (
    psql_run "select (public.consume_edge_rate_limit('$USER_ID','generate_quiz')->>'allowed');" > "$TMP_DIR/$n"
  ) &
done
wait

cat "$TMP_DIR"/* > "$TMP_DIR/all"
ALLOWED="$(grep -cx 'true' "$TMP_DIR/all" || true)"
DENIED="$(grep -cx 'false' "$TMP_DIR/all" || true)"
if [[ "$ALLOWED" -ne 3 || "$DENIED" -ne 5 ]]; then
  echo "Expected 3 allowed and 5 denied concurrent calls; got allowed=$ALLOWED denied=$DENIED" >&2
  cat "$TMP_DIR/all" >&2
  exit 1
fi

DENIAL="$(psql_run "select public.consume_edge_rate_limit('$USER_ID','generate_quiz')->>'code';")"
if [[ "$DENIAL" != "RATE_LIMIT_EXCEEDED" ]]; then
  echo "Expected stable RATE_LIMIT_EXCEEDED code, got $DENIAL" >&2
  exit 1
fi

SAVE_PAGES="$(psql_run "select public.consume_edge_rate_limit('$USER_ID','process_document_pages_save_pages')->>'allowed';")"
if [[ "$SAVE_PAGES" != "true" ]]; then echo "The dedicated save_pages counter did not allow its first request." >&2; exit 1; fi

# A one-second test window must reset without manual counter edits.
psql_run "update public.app_config set value=jsonb_set(value,'{free,create_document_signed_url,max_requests}','1'::jsonb) where key='edge_rate_limits';
  update public.app_config set value=jsonb_set(value,'{free,create_document_signed_url,window_seconds}','1'::jsonb) where key='edge_rate_limits';"
psql_run "select public.consume_edge_rate_limit('$USER_ID','create_document_signed_url')->>'allowed';" >/dev/null
sleep 2
RESET="$(psql_run "select public.consume_edge_rate_limit('$USER_ID','create_document_signed_url')->>'allowed';")"
if [[ "$RESET" != "true" ]]; then echo "Rate limit window did not reset." >&2; exit 1; fi

echo "PASS: concurrent per-user rate limit (3 allowed/5 denied), stable 429 code, dedicated save_pages bucket, and timed reset."
