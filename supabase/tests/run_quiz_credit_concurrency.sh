#!/usr/bin/env bash
# Exercises quiz reservation caps, concurrent claims, replay, settlement, and refunds.
# This script is called only by the clean-replay workflow against its disposable PostgreSQL service.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a disposable PostgreSQL database}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt)
USER_ID="00000000-0000-4000-8000-00000000caFe"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" <<SQL
insert into auth.users(id, email, raw_user_meta_data)
values ('$USER_ID', 'quiz-credit-test@example.invalid', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles(id, plan)
values ('$USER_ID', 'free')
on conflict (id) do update set plan = 'free';

update public.usage_limits set daily_credits = 10, monthly_credits = 100 where plan = 'free';
insert into public.credit_costs(feature, credits) values
  ('generate_quiz', 5)
on conflict (feature) do update set credits = excluded.credits;
update public.app_config set value = '1000'::jsonb where key = 'global_monthly_cost_cap';
SQL

# Twenty different keys race for a cap that can admit exactly two 5-credit reservations.
for i in $(seq 1 20); do
  key="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  printf '%s\n' "$key" >> "$TMP_DIR/keys"
  (
    "${PSQL[@]}" -c "select r_status from public.reserve_credits('$USER_ID', 'generate_quiz', '$key', 0.01);" > "$TMP_DIR/result-$i"
  ) &
done
wait

reserved="$(cat "$TMP_DIR"/result-* | grep -c '^reserved$' || true)"
denied="$(cat "$TMP_DIR"/result-* | grep -c '^denied$' || true)"
if [[ "$reserved" -ne 2 || "$denied" -ne 18 ]]; then
  echo "FAIL: expected 2 reservations and 18 denials; got $reserved reservations and $denied denials" >&2
  cat "$TMP_DIR"/result-* >&2
  exit 1
fi

first_key=""
second_key=""
index=0
while IFS= read -r key; do
  index=$((index + 1))
  if [[ "$(cat "$TMP_DIR/result-$index")" == "reserved" ]]; then
    if [[ -z "$first_key" ]]; then first_key="$key"; else second_key="$key"; fi
  fi
done < "$TMP_DIR/keys"
if [[ -z "$first_key" || -z "$second_key" ]]; then
  echo "FAIL: could not identify both successful reservation keys" >&2
  exit 1
fi
replay="$("${PSQL[@]}" -c "select r_status || ':' || r_replay::text from public.reserve_credits('$USER_ID', 'generate_quiz', '$first_key', 0.01);")"
if [[ "$replay" != "reserved:true" ]]; then
  echo "FAIL: same-key replay did not return the existing reservation: $replay" >&2
  exit 1
fi


"${PSQL[@]}" -c "select * from public.settle_credits('$USER_ID', 'generate_quiz', '$first_key', 0.01, 'openai', 'test-model', null, 10, '00000000-0000-4000-8000-000000000001');" >/dev/null
settled_replay="$("${PSQL[@]}" -c "select r_status || ':' || r_replay::text from public.reserve_credits('$USER_ID', 'generate_quiz', '$first_key', 0.01);")"
stored_result="$("${PSQL[@]}" -c "select result_ref from public.ai_usage_log where user_id = '$USER_ID' and feature = 'generate_quiz' and request_key = '$first_key';")"
if [[ "$settled_replay" != "succeeded:true" || "$stored_result" != "00000000-0000-4000-8000-000000000001" ]]; then
  echo "FAIL: settled replay did not return the stored result reference: $settled_replay" >&2
  exit 1
fi

"${PSQL[@]}" -c "select * from public.refund_credits('$USER_ID', 'generate_quiz', '$second_key', 'test_refund');" >/dev/null
reserved_after_refund="$("${PSQL[@]}" -c "select credits_reserved from public.usage_counters where user_id = '$USER_ID' and period_type = 'day' and period_start = (now() at time zone 'utc')::date;")"
used_after_settle="$("${PSQL[@]}" -c "select credits_used from public.usage_counters where user_id = '$USER_ID' and period_type = 'day' and period_start = (now() at time zone 'utc')::date;")"
if [[ "$reserved_after_refund" != "0" || "$used_after_settle" != "5" ]]; then
  echo "FAIL: refund/settlement counters incorrect (reserved=$reserved_after_refund used=$used_after_settle)" >&2
  exit 1
fi

echo "PASS: 20 concurrent calls admitted exactly 2 reservations; replay, settlement, and refund checks passed."
