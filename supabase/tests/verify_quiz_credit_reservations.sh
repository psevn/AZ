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
# Restore room for the success and failed-provider billing fixtures after the one-credit concurrency cap check.
psql_run "update public.usage_limits set daily_credits=10 where plan='free';"

# A settled request replay must return the existing success and stored safe payload.
psql_run "select r_status from public.reserve_credits('$USER_ID','$FEATURE','replay-key',0.001,1);" | grep -qx 'reserved'
psql_run "select r_status from public.settle_quiz_generation(
  '$USER_ID','$FEATURE','replay-key',0.001,'openai','test-model','quiz-v1',12,
  'test-quiz',10,20,jsonb_build_object('quizId','test-quiz','questions','[]'::jsonb)
);" | grep -qx 'succeeded'
REPLAY="$(psql_run "select r_status || '|' || r_replay from public.reserve_credits('$USER_ID','$FEATURE','replay-key',0.001,1);")"
PAYLOAD="$(psql_run "select result_payload->>'quizId' from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='replay-key';")"
TOKENS="$(psql_run "select input_tokens || '|' || output_tokens from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='replay-key';")"
REPLAY_ROWS="$(psql_run "select count(*) from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='replay-key';")"
if [[ "$REPLAY" != "succeeded|true" || "$PAYLOAD" != "test-quiz" || "$TOKENS" != "10|20" || "$REPLAY_ROWS" != "1" ]]; then
  echo "Idempotent replay or usage logging failed: replay=$REPLAY payload=$PAYLOAD tokens=$TOKENS" >&2
  exit 1
fi

# Failed provider generations still log model/token/cost data, and refund replay cannot double-count spend.
psql_run "select r_status from public.reserve_credits('$USER_ID','$FEATURE','failed-provider-key',0.01,1);" | grep -qx 'reserved'
psql_run "select r_status from public.refund_quiz_generation(
  '$USER_ID','$FEATURE','failed-provider-key','invalid_output','openai','test-model',7,11,0.002
);" | grep -qx 'refunded'
FAILED_USAGE="$(psql_run "select status || '|' || provider || '|' || model || '|' || input_tokens || '|' || output_tokens || '|' || cost_actual from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='failed-provider-key';")"
psql_run "select r_status from public.refund_quiz_generation(
  '$USER_ID','$FEATURE','failed-provider-key','retry_refund','openai','test-model',7,11,0.002
);" | grep -qx 'refunded'
SPEND="$(psql_run "select settled_cost from public.spend_counters where month=date_trunc('month',now() at time zone 'utc')::date;")"
# Compare numerically in SQL: cost_actual and settled_cost are numeric(14,6), so they render as 0.002000 / 0.003000.
# An empty result (missing row) is not "t", so a missing row still fails the check.
FAILED_USAGE_OK="$(psql_run "select status = 'refunded' and provider = 'openai' and model = 'test-model' and input_tokens = 7 and output_tokens = 11 and cost_actual = 0.002 from public.ai_usage_log where user_id='$USER_ID' and feature='$FEATURE' and request_key='failed-provider-key';")"
SPEND_OK="$(psql_run "select settled_cost = 0.003 from public.spend_counters where month=date_trunc('month',now() at time zone 'utc')::date;")"
if [[ "$FAILED_USAGE_OK" != "t" || "$SPEND_OK" != "t" ]]; then
  echo "Failed-call usage was not logged exactly once: usage=$FAILED_USAGE settled_spend=$SPEND" >&2
  exit 1
fi

# Configured base credits scale by the requested question/page multiplier.
psql_run "update public.usage_limits set daily_credits=100, monthly_credits=100 where plan='free';"
SCALED_CREDITS="$(psql_run "select r_credits from public.reserve_credits('$USER_ID','$FEATURE','scaled-credit-key',0.001,2.5);")"
if [[ "$SCALED_CREDITS" != "2.5" ]]; then
  echo "Configured quiz credits did not scale with the request: got $SCALED_CREDITS" >&2
  exit 1
fi
psql_run "select r_status from public.refund_credits('$USER_ID','$FEATURE','scaled-credit-key','scaled_credit_test');" | grep -qx 'refunded'

# The monthly user cap is independent of the daily cap.
psql_run "update public.usage_limits set daily_credits=100, monthly_credits=0 where plan='free';"
MONTHLY_REASON="$(psql_run "select r_reason from public.reserve_credits('$USER_ID','$FEATURE','monthly-cap-key',0.001,1);")"
if [[ "$MONTHLY_REASON" != "monthly_limit" ]]; then
  echo "Expected monthly_limit denial, got $MONTHLY_REASON" >&2
  exit 1
fi

# The global monthly spend cap is also enforced before any provider request.
psql_run "update public.usage_limits set daily_credits=100, monthly_credits=100 where plan='free';
  update public.app_config set value='0.0001'::jsonb where key='global_monthly_cost_cap';"
GLOBAL_REASON="$(psql_run "select r_reason from public.reserve_credits('$USER_ID','$FEATURE','global-cap-key',0.001,1);")"
if [[ "$GLOBAL_REASON" != "global_cap" ]]; then
  echo "Expected global_cap denial, got $GLOBAL_REASON" >&2
  exit 1
fi

echo "PASS: concurrent cap, scaled credits, daily/monthly/global caps, refunds, one-row idempotent replay, safe result persistence, and failed-call token/cost logging."
