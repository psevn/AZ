-- Additive metadata for the existing credit reservation lifecycle.
-- Reservation, settlement, and refunds continue to use the existing RPCs from
-- 20261105123204_credit_reservation_rpcs.sql; no parallel credit engine is introduced.

alter table public.ai_usage_log
  add column if not exists request_payload_hash text
  check (request_payload_hash is null or (char_length(request_payload_hash) = 64 and request_payload_hash !~ '[^0-9a-f]'));

alter table public.quiz_questions
  add column if not exists position_no integer
  check (position_no is null or position_no >= 1);

create unique index if not exists quiz_questions_quiz_position_key
  on public.quiz_questions (quiz_id, position_no)
  where position_no is not null;
