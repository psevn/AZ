-- Beta starting limits. Values come from docs/product/AI_COST_AND_ECONOMICS.md (budget-based caps).
-- Fail-closed defaults (all zero) are replaced here; the owner can tune any value later with a plain UPDATE.
-- Model pricing (app_config.openai_model_pricing) is intentionally NOT set here: it must be keyed by the
-- exact OPENAI_MODEL id, which the owner confirms after the model quality test.

update public.usage_limits set daily_credits = 10, monthly_credits = 100 where plan = 'free';
update public.usage_limits set daily_credits = 40, monthly_credits = 600 where plan = 'pro';

insert into public.credit_costs (feature, credits) values
  ('generate_quiz', 10),
  ('generate_summary', 6),
  ('weak_topic_quiz', 4),
  ('ask_question', 2)
on conflict (feature) do update set credits = excluded.credits;

-- Beta global monthly spend cap in USD (alerts at 50% / 80% are an operations task, not enforced here).
insert into public.app_config (key, value) values ('global_monthly_cost_cap', '30'::jsonb)
on conflict (key) do update set value = excluded.value;
