# Instructions for Claude working in AZ

Before changing product structure, UX, or branding, read:
- [AZ Intelligence — Product, Companion & Character Identity](docs/product/AZ-INTELLIGENCE-IDENTITY.md)
- [AZ Promo V5 — Web Design Reference](docs/design/AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md)
- [AZ Navigation & Naming Decision](docs/product/NAVIGATION-AND-NAMING.md)

## Key product and naming decisions

- **AZ** is the overall platform brand.
- The V1 primary navigation has exactly five destinations: **Home**, **Planning**, **Study**, **AZ Projects**, and the student's **profile avatar**.
- **Study** replaces the former **AZ** navigation label and occupies the center position in the five-item navigation.
- Keep **Planning** unchanged. Keep **Home** and **AZ Projects** unchanged.
- Show the student's profile image/avatar instead of a visible “Me” text label; provide an accessible name such as “Profile”.
- Use short, clear labels for primary navigation and a more distinctive, product-like naming style for internal features. Do not let futuristic names become unclear jargon.
- The navigation and naming source of truth, Study scope, examples that are not yet individually approved, and implementation guardrails are defined in [NAVIGATION-AND-NAMING.md](docs/product/NAVIGATION-AND-NAMING.md). Read it before any related work.
- Do not treat the naming decision as authorization for a broad redesign. Do not change routes, internal identifiers, database schemas, permissions, analytics event names, or feature behavior solely to match a visible label.
- Do not add AZ Intelligence/AZI as a sixth navigation item.
- **AZ Intelligence** is the intelligence system and main product capability (not AZ Core).
- **AZI** (pronounced “Ah-zee” / «آزي») is the default name of the primary student-facing personal companion.
- Students may customize the displayed nickname for their own AZI. This does not rename AZ Intelligence or change the companion's underlying identity.
- AZI should be context-aware, proactive when genuinely useful, and available on demand. Avoid interrupting students or implying surveillance.
- AZ Intelligence is an academic intelligence layer, not merely a chatbot or an AI API wrapper.
- It connects Study, Planning, AZ Projects, and other relevant areas of the product.
- Its long-term direction combines student context/data, deterministic analysis algorithms, AI via a secure server-side API, and an action layer for student-approved recommendations.
- AZ Intelligence may later support specialized agents (for example study, planning, research, and performance). These are future concepts, not features to assume are already implemented. AZI remains the primary companion and guide.
- Follow the trust, privacy, evidence, consent, and student-approval requirements in the product identity document.
- AZI should interact naturally and flexibly with people, but never have unlimited autonomy: follow AZ's explicit safety, privacy, permission, transparency, user-control, and accountability commitments. Confirm consequential actions unless narrowly pre-authorized.
- Treat “AZ المطلق” as a long-term vision only, not as a claim about current capabilities. Build toward it incrementally.
- The AZI character direction is documented there. It is a working creative direction only: no final character artwork has been generated or approved yet.

Do not contradict these decisions or invent implementation that is not present in the codebase. Inspect the existing architecture before proposing or making technical changes. Keep API secrets out of browser code.
