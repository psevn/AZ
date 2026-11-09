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
- The AZI character direction is documented there. It is a working creative direction only: no final character artwork has been generated or approved yet.

Do not contradict these decisions or invent implementation that is not present in the codebase. Inspect the existing architecture before proposing or making technical changes. Keep API secrets out of browser code.
