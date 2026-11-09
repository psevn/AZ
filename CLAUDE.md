# Instructions for Claude working in AZ

Before changing product structure, UX, or branding, read:
- [AZ Intelligence — Product, Companion & Character Identity](docs/product/AZ-INTELLIGENCE-IDENTITY.md)
- [AZ Promo V5 — Web Design Reference](docs/design/AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md)

## Key product and naming decisions

- **AZ** is the overall platform brand.
- **AZ Intelligence** is the intelligence system and main product section (not AZ Core).
- **AZI** (pronounced “Ah-zee” / «آزي») is the default name of the primary student-facing personal companion.
- Students may customize the displayed nickname for their own AZI. This does not rename AZ Intelligence or change the companion's underlying identity.
- AZI should be context-aware, proactive when genuinely useful, and available on demand. Avoid interrupting students or implying surveillance.
- AZ Intelligence is an academic intelligence layer, not merely a chatbot or an AI API wrapper.
- It connects Workspace, Notebook, Focus, and Planning.
- Its long-term direction combines student context/data, deterministic analysis algorithms, AI via a secure server-side API, and an action layer for student-approved recommendations.
- AZ Intelligence may later support specialized agents (for example study, planning, research, and performance). These are future concepts, not features to assume are already implemented. AZI remains the primary companion and guide.
- Follow the trust, privacy, evidence, consent, and student-approval requirements in the product identity document.
- AZI should interact naturally and flexibly with people, but never have unlimited autonomy: follow AZ's explicit safety, privacy, permission, transparency, user-control, and accountability commitments. Confirm consequential actions unless narrowly pre-authorized.
- Treat “AZ المطلق” as a long-term vision only, not as a claim about current capabilities. Build toward it incrementally.
- The AZI character direction is documented there. It is a working creative direction only: no final character artwork has been generated or approved yet.

Do not contradict these decisions or invent implementation that is not present in the codebase. Inspect the existing architecture before proposing or making technical changes. Keep API secrets out of browser code.


## Global product readiness

- Product principle: **Global by Design, Launching from Qatar.** Qatar is the first launch market, not a permanent product boundary.
- Keep country, UI language, academic/content language, locale, time zone, and currency as separate concepts. Never infer one from another.
- Do not hard-code Qatar-only assumptions into shared product logic (institution catalogs, country codes, academic calendars/terms, grading, dates, currency, or onboarding). Qatar-specific catalogs may exist as configurable market data.
- Support free-text institution entry and flexible academic-period naming when a catalog or local convention is unavailable.
- Treat date-only deadlines separately from timestamps; store instants consistently and render using the learner's intended time zone. Test daylight-saving transitions and cross-time-zone behavior where relevant.
- Keep country-specific catalogs, pricing, payments, legal requirements, privacy disclosures, and support readiness configurable and reviewed before market entry.
- Expansion sequence is a go-to-market plan (Qatar → Gulf → wider Arab world → selected global markets), not a technical restriction. Do not add unapproved V1 scope or claim a market is supported merely because the architecture is intended to support it.
- Read [Global Readiness Principles](docs/product/GLOBAL-READINESS-PRINCIPLES.md) before changing onboarding, dates, localization, catalogs, pricing, or country-specific behavior.
