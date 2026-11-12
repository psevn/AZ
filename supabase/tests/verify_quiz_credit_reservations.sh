#!/usr/bin/env bash
# Integration checks for the quiz credit RPCs. This script only targets the
# disposable database created by run_clean_replay.sh.
set -euo pipefail

if [[ -n "${PSQL_DOCKER_CONTAINER:-}" ]]; then
  psql_run() {
    docker exec "$PSQL_DOCKER_CONTAINER" psql -U postgres -d az_clean_replay -X -v ON_ERROR_STOP=1 -At -c "$1"
  }
else
  : "${DATABASE_URL:?Set DATABASE_URL to a disposable local PostgreSQL database}"
  psql_run() { psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$1"; }
fi

USER_ID="a1111111-1111-4111-8111-111111111111"
FEATURE="generate_quiz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

psql_run "insert into auth.users(id,email) values ('$USER_ID','quiz-credit-test@example.invalid') on conflict (id) do nothing;
  insert into public.profiles(id,plan) values ('$USER_ID','free')
  on conflict (id) do update set plan='free';
  update public.usage_limits set daily_credits=1, monthly_credits=100 where plan='free';
  insert into public.credit_costs(feature,credits) values ('$FEATURE',1)
  on conflict (feature) do update set credits=1;
  update public.app_config set value='100'::jsonb where key='global_monthly_cost_cap';"

# Fire eight distinct requests concurrently against a one-credit daily cap.
for n in 1 2 3 4 5 6 7 8; do
  (
    psql_run "select '$n|' || r_status from public.reserve_credits(
      '$USER_ID','$FEATURE','concurrent-$n',0.001,1
    );" > "$TMP_DIR/$n"
  ) &
done
wait

cat "$TMP_DIR"/* > "$TMP_DIR/all"
RESERVED_COUNT="$(grep -c '|reserved$' "$TMP_DIR/all" || true)"
DENIED_COUNT="$(grep -c '|denied$' "$TMP_DIR/all" || true)"
if [[ "$RESERVED_COUNT" -ne 1 || "$DENIED_COUNT" -ne 7 ]]; then
  echo "Expected one reservation and seven denials; got reserved=$RESERVED_COUNT denied=$DENIED_COUNT" >&2
  cat "$TMP_DIR/all" >&2
  exit 1
fi

WINNER="$(awk -F'|' '$2=="reserved" {print $1}' "$TMP_DIR/all")"
psql_run "select r_status from public.refund_credits('$USER_ID','$FEATURE','concurrent-$WINNER','test_failure');" | grep -qx 'refunded'
REFUNDED_COUNT="$(psql_run "select count(*) from public.ai_usage_log where user_id='$USER_ID' and request_key='concurrent-$WINNER' and status='refunded';")"
RESERVED_CREDITS="$(psql_run "select coalesce(sum(credits_reserved),0) from public.usage_counters where user_id='$USER_ID';")"
if [[ "$REFUNDED_COUNT" -ne 1 || "$RESERVED_CREDITS" != "0" ]]; then
  echo "Refund did not release the reservation: refunded=$REFUNDED_COUNT reserved=$RESERVED_CREDITS" >&2
  exit 1
fi

# A settled request replay must return the existing success and stored safe payload.
psql_run "select r_status from public.reserve_credits('$USER_ID','$FEATURE','replay-key',0.001,1);" | grep -qx 'reserved'
psql_run "select r_status from public.settle_quiz_generation(
  '$USER_ID','$FEATURE','replay-key',0.001,'openai','test-model','quiz-v1',12,
  'test-quiz',10,20,jsonb_build_object('quizId','test-quiz','questions','[]'::jsonb)
);" | grep -qx 'succeeded'
REPLAY="$(psql_run "select r_status || '|' || r_replay from public.reserve_credits('$USER_ID','$FEATURE','replay-key',0.001,1);")"
PAYLOAD="$(psql_run "select result_payload->>'quizId' from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='replay-key';")"
TOKENS="$(psql_run "select input_tokens || '|' || output_tokens from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='replay-key';")"
if [[ "$REPLAY" != "succeeded|t" || "$PAYLOAD" != "test-quiz" || "$TOKENS" != "10|20" ]]; then
  echo "Idempotent replay or usage logging failed: replay=$REPLAY payload=$PAYLOAD tokens=$TOKENS" >&2
  exit 1
fi

echo "PASS: concurrent cap (1 allowed/7 denied), refund, settled replay, safe result persistence, and token usage logging."
