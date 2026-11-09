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

- The approved AZ V1 primary navigation has exactly five destinations, in order: Home, Planning, AZ Intelligence, AZ Projects, and the student's profile represented by their chosen profile picture/avatar (not a visible “Me” label). Older primary-navigation proposals such as Study or More are superseded.
- AZI is available across AZ, not only inside the AZ Intelligence section. It may navigate between the five primary destinations and relevant existing internal screens while respecting the student's access and current context. Navigation does not itself authorize edits or other consequential actions.
- AZI may be explicitly invoked into an optional voice-conversation session (for example, by pressing AZI). Voice must never start listening automatically on page load or silently in the background. Show clear microphone permission, listening/speaking, mute, and end-session states; keep text interaction available if voice is unavailable.
- Voice and cross-section navigation are approved product directions, not proof of implementation. Inspect the codebase and implement incrementally; do not claim capabilities exist until verified.
