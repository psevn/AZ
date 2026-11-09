# Instructions for Claude working in AZ

Before changing product structure, UX, or branding, read:
- [AZ Intelligence — Product & Character Identity](docs/product/AZ-INTELLIGENCE-IDENTITY.md)
- [AZ Promo V5 — Web Design Reference](docs/design/AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md)

Key product decision:
- The main intelligence section is named **AZ Intelligence** (not AZ Core).
- AZ Intelligence is the academic intelligence layer, not merely a chatbot or an AI API wrapper.
- It connects Workspace, Notebook, Focus, and Planning.
- Its long-term direction combines student context/data, deterministic analysis algorithms, AI via a secure server-side API, and an action layer for student-approved recommendations.
- Follow the trust, privacy, evidence, and student-approval requirements in the product identity document.
- The mascot/character direction is documented there. It is a working creative direction only: no final character artwork has been generated or approved yet.

Do not contradict these decisions or invent implementation that is not present in the codebase. Inspect the existing architecture before proposing or making technical changes. Keep API secrets out of browser code.
