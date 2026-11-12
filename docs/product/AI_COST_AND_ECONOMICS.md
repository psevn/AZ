# AZ — AI cost, student value and unit economics

Status: **proposal for PSEVN's decision** (prepared 2026-11-12). Nothing here is applied to any database or deployed.
Goal: give students (free and paid) the **most AI usage per dollar** while keeping a healthy margin.

## 1. Inputs and how well each is verified

| Input | Value | Verification |
|---|---|---|
| Gemini 2.5 Flash-Lite (paid) | $0.10 in / $0.40 out per 1M tokens; cached input $0.01; Batch = 50% | **Official** Google pricing page, read 2026-11-12 |
| Gemini 2.5 Flash (paid) | $0.30 in / $2.50 out; cached $0.03; Batch 50% | **Official**, same page |
| OpenAI gpt-6-astra | $10 in / $1 cached / $50 out | **Third-party** (Morph, updated 2026-10-31); openai.com pricing page could not be read. Re-check on OpenAI's own page |
| OpenAI gpt-6.1-terra | $1 / $0.05 / $5 | Third-party, same |
| OpenAI gpt-6-luna | $0.10 / $0.01 / $0.50 | Third-party, same |
| OpenAI gpt-5-nano | $0.05 / $0.005 / $0.40 | Third-party, same |
| OpenAI Batch | 50% of standard | Third-party, same |
| Supabase Pro | from $25/month; 8 GB DB, 100 GB storage, 250 GB egress, 100k MAU, 2M function calls included; extra projects from $10/month | **Official** Supabase docs page, read 2026-11-12 |
| Supabase Free | 500 MB DB, 1 GB storage, 5 GB egress, 2 active projects, pauses after 1 week idle | Official, same |
| Student price | target $6.99/month; first 500 students $4.99 | PSEVN's decision (DECISIONS.md), still an assumption |

**Not verified / unknown:** see section 11 for the second verification pass. Still unknown: fixed per-transaction fees, FX and chargeback costs, real token usage of our prompts, real output quality of cheap models in Arabic, and OpenAI's own current prices (two third-party sources disagree).

## 2. Assumed token size per action (ESTIMATES — replace with measured numbers from AZ-Staging)
- Quiz from a lecture (8 questions): ~15k input, ~2k output.
- Short quiz on a weak topic (5 questions, only relevant pages): ~3k in, ~0.8k out.
- Ask a question grounded in the material: ~4k in, ~0.4k out.
- Summary of a document: ~15k in, ~1.5k out.

## 3. Cost per action (USD, computed from section 1 and 2)

| Model | Quiz 8q | Weak-topic quiz | Ask | Summary |
|---|---|---|---|---|
| gpt-6-astra | 0.250 | 0.070 | 0.060 | 0.225 |
| gpt-6.1-terra | 0.025 | 0.007 | 0.006 | 0.023 |
| gpt-6-luna | 0.0025 | 0.0007 | 0.0006 | 0.0023 |
| gpt-5-nano | 0.0016 | 0.0005 | 0.0004 | 0.0014 |
| gemini-2.5-flash-lite | 0.0023 | 0.0006 | 0.0006 | 0.0021 |
| gemini-2.5-flash | 0.0095 | 0.0029 | 0.0022 | 0.0083 |

**Finding:** `generate-quiz` currently defaults to `gpt-6-astra`. At the third-party price that is ~100x the cost of a small model for the same quiz. At 60 quizzes/month a Pro student would cost ~$15 against a $6.99 price. Never ship that default.

## 4. Caps expressed as a cost budget (worst case, every student uses everything)
- Free: **≤ $0.30 per student per month**.
- Pro: **≤ $1.50 per student per month** (about 20–30% of the price).
- Beta global hard stop: **$30/month** until PSEVN raises it; alerts at 50% and 80%.

What that buys per month (quiz 17k tokens each):

| Model | Free ($0.30) | Pro ($1.50) |
|---|---|---|
| gpt-6-astra | ~1 quiz (0.02M tokens) | ~6 quizzes (0.1M tokens) |
| gpt-6-luna | ~120 quizzes (2.0M tokens) | ~600 quizzes (10.2M tokens) |
| gemini-2.5-flash-lite | ~130 quizzes (2.2M tokens) | ~650 quizzes (11.1M tokens) |

**The model choice, not the cap, decides how generous we can be.** With a small model the caps can be 10x what we first proposed (10 and 60 quizzes) while costing less. Credits stay the student-facing unit; `credit_costs` is priced from measured cost.

## 5. Levers that raise student usage at the same cost (in order)
1. **Generate once, reuse:** store questions; retakes, mistake review and exam mode cost zero model calls.
2. **Send only relevant pages** for topic quizzes (we store `topic` and `source_page`).
3. **Route by task:** small model by default; a stronger model only for Professional Mode or a failed quality check.
4. **Provider caching** for repeated input on the same document (Google $0.01 vs $0.10 per 1M for Flash-Lite; OpenAI cached rates in section 1).
5. **Batch (50%)** only for non-urgent work (e.g. overnight weekly review packs), never for a student waiting.
6. **Rule-based features cost nothing and use no credits:** weakness analysis, streaks, spaced review scheduling, reminders.

## 6. Other costs (what we know)
- Supabase Pro $25/month (+ $10/month for a separate staging project if it needs its own paid project; confirm which plan each project is on). Storage/egress overage prices in section 1.
- Cloudflare hosting, domain, payment gateway fees, legal/registration, marketing ($100–$500 for the first 90 days per PSEVN): **fill in with real quotes**; do not guess.

## 7. Break-even (before payment fees and taxes — unknown)
Assume fixed infrastructure of $35/month (Supabase Pro + one extra project).

| Price | AI cost per Pro student | Contribution | Paying students to cover $35 |
|---|---|---|---|
| $4.99 | $0.20 (typical) | $4.79 | 8 |
| $4.99 | $1.50 (worst case) | $3.49 | 10 |
| $6.99 | $0.20 | $6.79 | 6 |
| $6.99 | $1.50 | $5.49 | 7 |

For $10,000/month before fees/tax at $6.99 with ~$0.30 average AI cost: about **1,500 paying students**. Free-to-paid conversion is unknown; the target of 20,000 students is only meaningful with a measured conversion rate.

## 8. Student value (why this is fair, not just cheap)
- Free students get a real first experience (their own PDF -> quiz -> weak topic) without a paywall on the aha moment.
- Paid students get volume, Professional Mode, exam-season top-ups and faster/better models where quality matters.
- Retakes, review, planning, streaks never consume credits.
- Honest limits: clear message and next reset date when a cap is reached; no silent degradation.

## 9. Decisions needed
1. Approve budget-based caps (section 4) as the design rule.
2. Default model: **no default**. Pick after a quality test of 2–3 models on the same Arabic and English lectures (accuracy of answers and page references), then use price as the tie-breaker.
3. Confirm OpenAI prices on OpenAI's own pricing page (our reading was third-party).
4. Provide real quotes for gateway, hosting plan, domain, legal.

## 10. How we keep this honest
- Every AI call writes `ai_usage_log` (feature, model, tokens, cost). Weekly check: real cost per active student vs the budgets above.
- Re-run sections 3–4 whenever the model or provider price changes. Prices change; this document's numbers carry a date.

## 11. Second verification pass (2026-11-12)

| Item | Finding | Level |
|---|---|---|
| OpenAI prices | **Unresolved.** openai.com's pricing page showed only business seat plans. Morph (2026-10-31) lists gpt-6-luna at $0.10/$0.50 and gpt-5.6-luna at $0.20/$1.20; Finout (2026-05-11) lists gpt-5.6-luna at $1.00/$6.00 and does not list the gpt-6 models. Same name, 5x apart. Treat every OpenAI number in this document as unverified until PSEVN reads OpenAI's own pricing page in his account. Planning rule: assume up to 5x the small-model numbers above. | Unverified, conflicting |
| Payment gateway (Qatar) | Tap Payments publishes 2.0%-2.75% per transaction; MyFatoorah from 2.5% and marked as supporting recurring payments (Tap not marked). Fixed fees, FX and chargebacks excluded and not listed. The comparison site says its data is indicative and may be out of date. Confirm with each provider before choosing. | Indicative, third-party |
| Cloudflare | Workers Free: 100,000 requests/day, 10 ms CPU per invocation. Paid: $5/month minimum, 10M requests included. Static asset requests are free and unlimited on both plans. Our collaboration Worker for Projects uses Durable Objects: check the plan requirement before launch. | Official docs |
| Qatar licence (Wafeq article, updated 2025-09-16) | Commercial registration QAR 500; annual licence QAR 500 (QAR 300 home-based); trade name QAR 250-1,000; optional legal help QAR 1,370-4,100; LLC minimum capital QAR 200,000 (may not be due upfront). Some sources treat a physical address as required. Not legal advice; confirm with MOCI and a professional. | Secondary source, dated |

## 12. How many paying students for $10,000/month net profit?
Definition used: **net profit after AI, gateway fee, infrastructure and an assumed ~$100/month fixed overhead**; before taxes, marketing spend, support time and PSEVN's own time.
Assumptions: gateway 2.75% (top of the published Tap range, fixed fees ignored), AI cost $0.30 per paying student per month (small model), each free student costs $0.05 per month on average (the free budget cap is $0.30; real use is lower), every free student is paid for by the paying ones.

| Price | Free -> paid conversion | Net per paying student | Paying students needed | Total students needed |
|---|---|---|---|---|
| $6.99 | 10% | $6.05 | ~1,670 | ~16,700 |
| $6.99 | 5% | $5.55 | ~1,820 | ~36,400 |
| $6.99 | 3% | $4.88 | ~2,070 | ~69,000 |
| $4.99 | 10% | $4.10 | ~2,460 | ~24,600 |
| $4.99 | 5% | $3.60 | ~2,800 | ~56,100 |
| $4.99 | 3% | $2.94 | ~3,440 | ~114,700 |

Reading: at $6.99 about **1,700-2,100 paying students**. The $4.99 promo needs ~50% more, so keep it limited to the first 500. The 20,000-student ambition reaches $10k only if conversion is about 8-10%; at 5% it yields roughly $5.5k.
Worst case warning: if every free student used the full $0.30 and every paying student the full $1.50, the unit margin would be negative. The global monthly spend cap is what protects the business; it must be enforced in the database before any public beta.
