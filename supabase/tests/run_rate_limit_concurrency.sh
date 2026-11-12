#!/usr/bin/env bash
# Concurrent per-user rate-limit integration checks; disposable PostgreSQL only.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a disposable PostgreSQL database}"

PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt)
USER_A="00000000-0000-4000-8000-00000000a701"
USER_B="00000000-0000-4000-8000-00000000b701"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" <<SQL
insert into auth.users(id, email, raw_user_meta_data)
values
  ('$USER_A', 'rate-limit-a@example.invalid', '{}'::jsonb),
  ('$USER_B', 'rate-limit-b@example.invalid', '{}'::jsonb)
on conflict (id) do nothing;
insert into public.profiles(id, plan)
values ('$USER_A', 'free'), ('$USER_B', 'free')
on conflict (id) do update set plan = 'free';

insert into public.app_config(key, value)
values (
  'request_rate_limits',
  '{
    "free": {
      "create_document_upload_url": {"window_seconds": 3600, "max_requests": 5},
      "create_document_signed_url": {"window_seconds": 3600, "max_requests": 10},
      "process_document_pages": {"window_seconds": 3600, "max_requests": 10},
      "process_document_pages_save_pages": {"window_seconds": 3600, "max_requests": 3},
      "generate_quiz": {"window_seconds": 3600, "max_requests": 2}
    },
    "pro": {
      "create_document_upload_url": {"window_seconds": 3600, "max_requests": 50},
      "create_document_signed_url": {"window_seconds": 3600, "max_requests": 100},
      "process_document_pages": {"window_seconds": 3600, "max_requests": 100},
      "process_document_pages_save_pages": {"window_seconds": 3600, "max_requests": 30},
      "generate_quiz": {"window_seconds": 3600, "max_requests": 20}
    }
  }'::jsonb
)
on conflict (key) do update set value = excluded.value;
SQL

# Twenty parallel calls from one user must admit exactly five in the same window.
for i in $(seq 1 20); do
  (
    "${PSQL[@]}" -c "select case when result->>'ok' = 'true' then 'allowed' else result->>'error_code' end from (select public.consume_user_rate_limit('$USER_A', 'create_document_upload_url') as result) call;" > "$TMP_DIR/upload-$i"
  ) &
done
wait
allowed="$(cat "$TMP_DIR"/upload-* | grep -c '^allowed$' || true)"
denied="$(cat "$TMP_DIR"/upload-* | grep -c '^RATE_LIMIT_EXCEEDED$' || true)"
if [[ "$allowed" -ne 5 || "$denied" -ne 15 ]]; then
  echo "FAIL: expected 5 allowed and 15 denied upload requests; got $allowed allowed and $denied denied" >&2
  cat "$TMP_DIR"/upload-* >&2
  exit 1
fi

# Counters are per-user and per-endpoint, not a shared global bucket.
other_user="$("${PSQL[@]}" -c "select (public.consume_user_rate_limit('$USER_B', 'create_document_upload_url')->>'ok')::boolean;")"
other_endpoint="$("${PSQL[@]}" -c "select (public.consume_user_rate_limit('$USER_A', 'create_document_signed_url')->>'ok')::boolean;")"
if [[ "$other_user" != "t" || "$other_endpoint" != "t" ]]; then
  echo "FAIL: rate limits were not isolated by user and endpoint" >&2
  exit 1
fi

# save_pages has its own stricter configured bucket.
for i in $(seq 1 5); do
  (
    "${PSQL[@]}" -c "select case when result->>'ok' = 'true' then 'allowed' else result->>'error_code' end from (select public.consume_user_rate_limit('$USER_A', 'process_document_pages_save_pages') as result) call;" > "$TMP_DIR/save-$i"
  ) &
done
wait
save_allowed="$(cat "$TMP_DIR"/save-* | grep -c '^allowed$' || true)"
save_denied="$(cat "$TMP_DIR"/save-* | grep -c '^RATE_LIMIT_EXCEEDED$' || true)"
if [[ "$save_allowed" -ne 3 || "$save_denied" -ne 2 ]]; then
  echo "FAIL: expected 3 allowed and 2 denied save_pages requests; got $save_allowed allowed and $save_denied denied" >&2
  cat "$TMP_DIR"/save-* >&2
  exit 1
fi

"${PSQL[@]}" -c "delete from public.app_config where key = 'request_rate_limits';"
missing="$("${PSQL[@]}" -c "select public.consume_user_rate_limit('$USER_A', 'generate_quiz')->>'error_code';")"
if [[ "$missing" != "RATE_LIMIT_CONFIGURATION_MISSING" ]]; then
  echo "FAIL: missing rate-limit configuration did not fail closed: $missing" >&2
  exit 1
fi

echo "PASS: concurrent per-user limits, endpoint isolation, stricter save_pages cap, and fail-closed config passed."
