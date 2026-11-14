# AZ — Business Model and Pricing Strategy

**Status:** Founder-approved strategic direction; operational figures remain proposals until validated by beta data.  
**Owner:** PSEVN / EZORD  
**Last updated:** 2026-11-14  
**Scope:** AZ subscription pricing, unit economics, AI usage policy, growth, and future price evolution.

> This document is the commercial source of truth for AZ's pricing strategy. The companion document [AI cost, student value and unit economics](./product/AI_COST_AND_ECONOMICS.md) contains the detailed model/provider cost research and technical cost assumptions. If an older price assumption in that companion document conflicts with this document, this document supersedes it for commercial pricing; technical cost evidence should still be revalidated before launch.

## 1. Strategic direction

AZ follows a **balanced growth and profitability strategy**:

- Keep the core student subscription accessible and compelling.
- Deliver meaningful academic value across the connected learning loop: Plan → Study → Practice → Review mistakes → Improve.
- Make AI usage generous enough to feel useful, but economically bounded and measured.
- Prefer efficient product design, reuse, routing, and deterministic logic over bluntly restricting students.
- Grow acquisition and retention without allowing variable costs to grow unchecked.
- Reinvest in product quality while maintaining a sustainable contribution margin.

AZ is not positioned as a cheap bundle of AI calls. Students pay for an integrated academic experience, not for a visible token balance.

## 2. Launch pricing direction

| Item | Proposed launch value | Meaning |
|---|---:|---|
| Public monthly list price | **US$7.99/month** | The displayed and charged subscription price, subject to local currency, taxes, and payment-provider presentation |
| Conservative planning baseline | **US$6.99 per paid subscriber/month** | Internal planning proxy used to avoid building plans around the full list price |
| Difference | **US$1.00** | A prudential planning buffer, not a literal fee, tax, profit, or separate AI wallet |
| AI operating-cost target | **15–20% of the US$6.99 planning baseline** (about **US$1.05–US$1.40**) | Initial target range to validate with measured usage; not a guaranteed per-user allowance or hard entitlement |

### Important accounting distinction

US$7.99 is the proposed customer-facing list price. US$6.99 is only a conservative planning assumption. It is **not** the accounting revenue figure, the amount actually collected, or an instruction to spend US$6.99 on a subscriber.

Actual net receipts must be calculated from collected payments after applicable taxes, refunds, chargebacks, currency conversion, payment-provider percentage fees, and fixed transaction fees. The business must not double-count the US$1 difference as a guaranteed reserve or profit.

Do not advertise a discount from US$7.99 unless a genuine, clearly described promotional price is actually offered. The previously discussed US$4.99 offer for the first 500 students is **not approved by this document** and requires a separate margin and grandfathering decision.

## 3. What the subscription should feel like

The paid plan should provide a cohesive academic workflow rather than a disconnected list of AI features:

- Planning and focus workflows.
- Study materials and document-based learning.
- Summaries, practice questions, flashcards, and exam practice as released and validated.
- Ask Your Materials with clear source/page-reference trust indicators.
- Mistake review and evidence-based weakness insights.
- AZI as a text-first academic companion with contextual notes and permission-checked suggestions/actions.

The product must clearly communicate which features are included, what usage limits apply, and when limits reset. Avoid describing AI usage as unlimited unless the underlying technical and financial policy truly supports it.

## 4. AI usage and cost policy

### 4.1 Student experience

- Do not expose raw token accounting as the primary student experience.
- Explain practical limits in plain language (for example, available actions or a clear usage allowance and reset date).
- Do not silently lower answer quality when a student approaches a limit.
- Preserve access to non-AI learning workflows where possible when AI limits are reached.
- Reuse previously generated artifacts for retakes, review, and exam practice rather than paying for repeated generation.
- Do not charge AI credits for deterministic features such as streak calculations, basic progress aggregation, or spaced-review scheduling unless a future design explicitly requires AI.

### 4.2 Cost-efficient execution

Use the least expensive model/provider that passes the task-specific quality bar. Route to a stronger model only when complexity or a quality check justifies it. Keep provider abstraction so OpenAI remains the initial provider without preventing a future Gemini option.

Priority order:

1. Deterministic logic before AI when it meets the need.
2. Generate once and reuse stored outputs.
3. Retrieve only relevant document pages/chunks, not entire documents by default.
4. Use small/efficient models for routine tasks after Arabic and English quality tests.
5. Escalate selectively for complex tasks or Professional Mode when justified.
6. Apply caching and asynchronous/batch processing when they do not harm the student experience.
7. Record actual provider, model, feature, token counts, latency, estimated/actual cost, and outcome per call without logging secrets or unnecessary document content.

### 4.3 Initial financial guardrails

- Target AI cost: **US$1.05–US$1.40 per paid subscriber/month on average**, based on the US$6.99 planning baseline.
- Treat **US$1.50 per paid subscriber/month** as a provisional review threshold inherited from the detailed unit-economics proposal, not as a permanent allowance or an unconditional hard cap.
- Set separate, evidence-based budgets for free users, paid users, and global beta spend.
- Configure a global monthly spend cap and alerts before public beta. A cap must fail safely and communicate clearly; do not promise a limit that is not enforced server-side.
- Review cohort averages and high-percentile usage (for example, p50, p90, and p95), not only the mean. A small number of extreme users can hide inside a healthy average.
- Recalculate limits whenever model pricing, prompts, product features, or usage patterns materially change.

No exact token quota or final credit price is approved by this document. Those values must be derived from current official provider prices, quality testing, real token usage, and the existing reservation/settlement/refund lifecycle.

## 5. Unit economics and reporting

Track monthly, with cohort breakdowns where possible:

| Metric | Definition / purpose |
|---|---|
| Gross billings | Successful subscription charges before deductions |
| Net subscription receipts | Collected subscription revenue after taxes collected on behalf of authorities, refunds, chargebacks, FX, and payment fees as applicable |
| AI cost per paid subscriber | Actual logged AI cost divided by paid subscribers in the period |
| AI cost per active student | AI cost divided by active students, segmented free/paid |
| Infrastructure cost per active student | Allocated database, storage, compute, bandwidth, and other infrastructure costs |
| Contribution per paid subscriber | Net receipts less variable AI, payment, storage, and infrastructure costs attributable to that subscriber |
| Gross/contribution margin | Contribution divided by the clearly defined revenue base |
| Free-to-paid conversion | Share of eligible free cohort converting to paid within a defined window |
| Churn and retention | Paid cancellations and cohort retention over time |
| Feature adoption | Usage and repeat usage of core academic workflows |
| Support/refund/chargeback rate | Operational and payment quality signals |

Do not label revenue after AI cost alone as net profit. Net profit must also account for fixed infrastructure, support, marketing, legal/compliance, taxes, and other operating expenses.

### Simple planning formulas

- **Gross monthly billings** = paid subscribers × actual monthly list/offer price collected.
- **Net receipts** = gross billings − applicable taxes collected − refunds/chargebacks − payment/FX fees.
- **AI cost ratio** = AI cost ÷ net receipts (also report against the US$6.99 planning baseline for consistency).
- **Contribution** = net receipts − variable AI − variable infrastructure/storage − other variable service costs.
- **Operating result** = contribution − fixed operating expenses − marketing and other operating costs.

The 100 / 500 / 1,000 / 5,000 / 10,000 subscriber examples are scale illustrations only; they are not forecasts, profit estimates, or a promise of conversion/retention.

## 6. Pricing evolution as AZ grows

AZ may raise its subscription price as the product becomes more valuable and the business scales. The intended direction is **value-led, evidence-based price evolution**, not automatic price increases triggered by subscriber count alone.

Potential future value additions include **AZ Arena**, richer collaboration and university experiences, and other substantial academic capabilities. These are future possibilities, not promises that a specific feature will ship in a particular release.

### Price-review triggers

Review pricing when several of the following are true:

- A meaningful set of new capabilities has shipped and is reliably used (not merely announced).
- Students demonstrate stronger retention, repeat usage, and willingness to pay.
- AZ provides materially more academic value than at launch.
- Support, infrastructure, compliance, or AI costs have changed sustainably.
- Competitive research and market testing support the proposed price.
- The new price still fits the target student market and the value delivered.

Subscriber growth is an important signal and can improve economies of scale, but **more subscribers alone do not justify charging more**. Scale can also reduce unit costs. A price increase should be supported by added value, demonstrated demand, sustainable costs, or a deliberate repositioning.

### How to introduce increases

1. Reassess the value delivered and current unit economics before changing a price.
2. Test proposed pricing with new customers or controlled market experiments where appropriate.
3. Prefer applying a new list price to new subscribers first.
4. Decide explicitly whether existing subscribers are grandfathered, given a transition period, or moved to a new plan. Do not assume grandfathering or change existing prices silently.
5. Give clear advance notice and obtain any consent required by the payment method, contract, and applicable law.
6. Update pricing pages, checkout, terms, receipts, and support guidance consistently.
7. Measure conversion, cancellations, retention, and contribution after the change.

Do not use fake crossed-out prices, fabricated scarcity, or misleading claims about competitor pricing.

## 7. Future plans, premium capabilities, and AZ Arena

Keep the initial paid plan straightforward. Do not introduce multiple confusing tiers before the core subscription and usage economics are validated.

When AZ Arena and other substantial capabilities are ready, evaluate these options separately:

- **Include in the existing plan:** best when the feature increases the core plan's value and its costs remain sustainable.
- **Create a higher tier:** appropriate when the feature creates a clearly differentiated, recurring premium value for a meaningful segment.
- **Offer an optional add-on:** appropriate when demand is specialized and not every student should pay for it.

AZ Arena must not automatically become a paid-only feature. Decide based on its actual value, operating cost, network effects, fairness, and adoption. Keep the core academic learning loop valuable and coherent at the base tier.

## 8. Growth strategy

Balance acquisition, activation, retention, and contribution margin:

- Give free students a useful first experience that demonstrates AZ's academic value, while enforcing a sustainable free-tier budget.
- Convert through demonstrated value, not dark patterns or artificial obstruction.
- Emphasize the integrated academic workflow and student affordability.
- Make competitor comparisons only when current, like-for-like feature and price evidence supports the claim.
- Run controlled experiments on messaging, onboarding, and offers.
- Do not scale paid acquisition until conversion, retention, and contribution are measured well enough to estimate payback.

## 9. Review cadence and decision gates

### Before public beta

- Confirm official model pricing and test Arabic/English quality on representative academic material.
- Validate the actual cost-logging and credit reservation/settlement/refund lifecycle.
- Configure per-user and global spend limits with alerts and safe failure behavior.
- Confirm payment-provider recurring billing, transaction fees, refunds, FX, tax handling, and supported markets.
- Define the included plan features and clearly communicate limits.
- Do not launch with unverified pricing or an unbounded AI endpoint.

### First 15–50 beta students

- Measure real actions per student, tokens per action, cost by feature, and cost distribution.
- Collect qualitative feedback on value, limits, and willingness to pay.
- Fix wasteful prompts, retrieval, caching, and repeated generation before reducing useful student access.
- Do not infer global economics from a tiny or unrepresentative cohort.

### First 500 paid subscribers

- Review conversion, retention, contribution, AI cost distribution, support burden, and infrastructure cost.
- Decide whether any launch promotion is justified and what its expiry/legacy terms are.
- Do not raise prices solely because the 500-subscriber milestone has been reached.

### Ongoing

- Review operational cost and usage monthly.
- Conduct a formal pricing/value review at major product milestones or material market/provider-cost changes.
- Record each price decision, its evidence, affected cohorts, effective date, and communication plan.

## 10. Decision log

| Decision / direction | Status |
|---|---|
| Balanced strategy: balance growth and profitability | **Selected** |
| US$7.99/month public list price | **Proposed launch price; validate before checkout/public launch** |
| US$6.99 conservative planning baseline | **Selected planning assumption; not accounting revenue** |
| US$1.05–US$1.40 average AI cost target | **Initial target for beta validation** |
| US$1.50 AI cost review threshold | **Provisional; review against measured cohorts** |
| Exact user credit/token limits | **Open; derive from measured costs and quality** |
| Global monthly API hard cap | **Required before public beta; amount to be approved** |
| US$4.99 first-500 promotion | **Not approved; separate decision required** |
| Future price increases after substantial value expansion | **Strategic direction selected; no schedule or amount approved** |
| AZ Arena / premium tier / add-on packaging | **Future evaluation; no paywall decision approved** |

## 11. Related documents

- [AI cost, student value and unit economics](./product/AI_COST_AND_ECONOMICS.md) — provider pricing research, model cost estimates, cost controls, and detailed scenarios.
- [AZ product and engineering documentation](./) — product scope, security, architecture, and implementation specifications.

---

**Governance:** This document defines strategy and planning assumptions. It does not authorize a subscription launch, price change, payment-provider configuration, model selection, API spend increase, database migration, or deployment. Each operational change requires its own verification and explicit approval.
