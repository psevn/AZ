# AZ — Global Readiness Principles

**Decision:** Global by Design, Launching from Qatar  
**Status:** Product and architecture direction approved for planning; implementation is partial and must be verified feature by feature.  
**Scope:** Documentation and engineering guardrails. This document does not authorize new V1 features, purchases, deployments, or changes to the live website.

## 1. Core decision

AZ is intended to become a global academic platform. Qatar is the first launch and validation market, not the product's permanent geographic boundary.

The product should be designed so that serving another country is primarily a matter of configuration, localization, market data, operational readiness, and validation—not rebuilding shared product foundations.

The go-to-market sequence is:

1. Qatar — first beta and learning market.
2. Gulf countries — expand when product reliability and local readiness are demonstrated.
3. Wider Arab world — support diverse institutions, academic conventions, dialects, and student needs.
4. Selected global markets — begin with markets where language, product fit, support, and compliance can be served well.

This sequence is a distribution strategy, not a technical restriction. It does not mean AZ must wait until it has saturated one region before learning from students elsewhere.

## 2. Separate concepts that must not be conflated

The data model and product logic must keep these concepts independent:

- **Country:** the learner's selected country or relevant market.
- **UI language:** the language used by AZ's interface.
- **Academic/content language:** the language of a course, document, or study material; it may differ from the UI language.
- **Locale:** formatting conventions for dates, numbers, and names.
- **Time zone:** the learner's actual time zone, not a guess based only on country.
- **Currency:** the currency used for displayed prices or transactions.
- **Institution:** a school, college, university, or other learning provider.
- **Academic structure:** the institution's own terms, semesters, trimesters, quarters, school years, modules, or custom periods.

Never infer country from language, currency from country without an explicit market rule, or academic calendar from country alone.

## 3. Onboarding and academic setup

- Let learners select or confirm their country where it is relevant.
- Keep institution selection optional where it is not needed to proceed.
- Support searching a country-specific institution catalog when available.
- Always provide a sensible free-text path for an institution that is missing or not listed.
- Do not make a Qatar-only catalog a global dependency.
- Keep education level, year/grade, specialization, and academic period flexible enough for different education systems.
- Let the learner name their academic period when local terminology differs.
- Avoid assuming that all universities use semesters or that all schools share the same academic year.
- A catalog should improve convenience, not prevent a learner from using AZ.

## 4. Dates, deadlines, schedules, and time zones

- Distinguish a **date-only value** (for example, an assignment due on 12 May) from a **timestamp** representing a precise moment.
- Store precise instants consistently (normally UTC) and render them in the learner's intended time zone.
- Do not convert date-only deadlines through UTC in a way that can shift the calendar day.
- Store the applicable time zone for recurring local class meetings and scheduled events.
- Use the browser/device time zone only as a suggested default; allow correction when needed.
- Test midnight boundaries, users traveling, daylight-saving changes, and recurring events across time zones.
- Ensure daily Planning filters and countdowns use the learner's local calendar day.
- Do not assume Qatar time (Asia/Qatar) in shared product logic.

## 5. Localization and accessibility

- Maintain high-quality Arabic and English experiences, including RTL and LTR.
- Do not mix directionality assumptions into shared layout components.
- Prepare translation architecture for additional locales without duplicating entire product flows.
- Localize dates, numbers, plural forms, and other conventions appropriately.
- Preserve readable typography, keyboard support, touch support, and reduced-motion preferences.
- Do not treat translation alone as complete localization; course terminology and student expectations may differ by market.

## 6. Country-specific data and market configuration

Country-specific data must be configurable and separable from core product logic. This includes:

- Institution and campus catalogs.
- Academic calendars and term conventions.
- Grade/year labels and grading scales where needed.
- Supported payment methods, displayed currency, and pricing.
- Legal notices, privacy disclosures, consent requirements, and data-retention rules.
- Support hours, contact channels, and localized help content.

Do not add a country-specific rule to shared logic when it belongs in market configuration. Do not claim a country is supported until the relevant product, operational, and legal checks have been completed.

## 7. Privacy, security, compliance, and trust

Before entering each market, review applicable requirements for privacy, data protection, student/minor data where relevant, consumer protection, subscriptions, taxes, AI transparency, copyright, and institutional policies.

Keep data access scoped to the authenticated user and authorized project/team memberships. International expansion must not weaken tenant isolation, Row Level Security, consent, deletion, or data minimization.

Do not collect a learner's country, institution, or other profile information unless it has a clear product or operational purpose and is explained appropriately.

## 8. Global pricing and payments

- Keep internal pricing logic separate from formatted price display.
- Do not assume one currency or one price is appropriate for every market.
- Before enabling a market, assess payment availability, taxes, refunds, subscription rules, local purchasing power, and support burden.
- Never imply that a currency selector alone makes payments globally available.
- Do not purchase services, domains, subscriptions, or integrations without explicit founder approval.

## 9. Engineering review checklist

Before shipping or materially changing a shared feature, ask:

1. Does it accidentally assume Qatar, QAR, Asia/Qatar, a Qatar institution, or one academic calendar?
2. Are country, language, locale, time zone, and currency independent?
3. Can a student proceed if their institution is absent from the catalog?
4. Are date-only deadlines protected from time-zone shifts?
5. Does it work in both Arabic RTL and English LTR?
6. Are user data, team permissions, and deletion rules preserved?
7. Are local market requirements configurable rather than embedded in shared code?
8. Have tests covered at least one non-Qatar locale/time zone and a non-semester academic-period example where relevant?

## 10. Current implementation status — do not overclaim

The intended direction is global, but the current codebase is not yet certified as globally ready.

A previous repository review observed:
- Arabic/English interface strings and RTL/LTR handling in the current app.
- Browser time-zone detection in an academic setup flow on a development branch.
- Flexible institution text entry and academic-period naming in an onboarding development branch.
- A Qatar-specific institution catalog filter in a separate development branch.
- Date filtering and deadline conversion logic that need explicit time-zone and date-only review.

These observations are branch-specific snapshots, not proof that all changes are merged into `main`, deployed, or production-ready. Re-check the active branch and current code before relying on them.

## 11. V1 and delivery guardrails

Global readiness is an architectural quality constraint, not permission to expand the V1 feature list without review.

Keep the agreed V1 student workflows and AZ Projects priorities intact. Prefer small foundational improvements that prevent country-specific coupling. Defer broad country catalogs, complex international billing, extensive compliance automation, and additional locales until there is a validated need and a clear implementation plan.

The website must not be changed merely by updating this strategy document. Any code, schema, deployment, or live configuration change requires a separate implementation task and appropriate review.

---

**Short principle:** Build the foundations for students everywhere. Launch carefully, learn from Qatar first, and expand as fast as product quality and market readiness responsibly allow.
