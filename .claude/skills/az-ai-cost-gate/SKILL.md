---
name: az-ai-cost-gate
description: Use when a feature, prompt, model or pricing change calls an AI provider or changes credit costs, usage limits or margin assumptions. Checks server-side use, the credit flow, cost per operation and margin before merge.
---

# AZ AI cost gate

Every AI call costs money, and the business depends on a bounded cost per student. A feature that calls an AI provider is not ready until it passes this gate. Pricing assumptions live in `docs/PRICING.md` (where present) and are **unmeasured until Stage C**. Do not invent prices; verify current provider prices from the provider's own pages and say when you did.

## 1. Architecture checks
- Calls happen only server-side (Supabase Edge Function). No provider key in browser code, logs, prompts or the repo.
- Features call the internal provider interface, not a provider SDK (SPEC §8.1). Prompts are versioned and `prompt_version` is logged.
- Output is validated against a JSON schema. Content from files, websites or PDFs is untrusted data and cannot change instructions or permissions (include a hidden-instruction test).

## 2. Credit flow (SPEC §9; functions exist in the live database)
1. The feature has a row in `credit_costs`.
2. `reserve_credits(user, feature, request_key, est_cost)` runs first. The provider is called **only** if it returns `reserved` and the call is not a replay.
3. On success `settle_credits` with the actual cost, provider, model, prompt version and latency. On error, timeout or invalid output `refund_credits`.
4. `request_key` is idempotent: a double click or retry must not cause a second provider call or charge.
5. Pass the worst-case estimated cost as `est_cost`. The global monthly cap is checked there (a cap of 0 denies everything by design).
6. The reserve/settle/refund functions are callable by `service_role` only.
7. Required tests with a mock provider that counts calls: same key x50 gives one call; different keys never exceed the user cap; failure refunds; a killed function is refunded by the sweep.

## 3. Cost worksheet (fill in; state which numbers are measured)
| Item | Value | Source |
|---|---|---|
| Input tokens (relevant pages only, not the whole file) | | measured / estimated |
| Output token cap | | |
| Model and price per 1M input / output tokens | | provider page, date checked |
| Cost per operation | | |
| Operations per student per month at the cost cap (cap divided by cost per operation) | | |
| Margin at the cap vs the subscription price (include payment fees) | | PRICING.md assumptions |
Report cost per usable question, not only cost per call (SPEC §8.2).

## 4. Ways to lower cost (try in this order)
1. Generate once, store, and replay for free (sessions, flashcards, spaced review, mistake review use stored content).
2. Send only the relevant pages.
3. Use a cheaper model for simple steps (topic labels, extraction) and a stronger one only for generation.
4. Cap output length and use structured output.
5. Provider prompt caching: verify support and conditions before relying on it.
Do not reuse generated questions across users without a separate privacy decision.

## 5. Free vs paid rule (from PRICING.md)
Organizing, replaying and reviewing stored content is free. AI generation from a student's files is paid and capped. AI inside group Projects is charged to the user who triggers it.

## 6. Approval and reporting
- No new paid provider, model tier or subscription without PSEVN's explicit approval.
- Raising a student's quota is a configuration change in `usage_limits`/`credit_costs`; do it only with measured cost data, and start low.
- In the PR, include the filled worksheet, the tests run, and what remains an assumption.
