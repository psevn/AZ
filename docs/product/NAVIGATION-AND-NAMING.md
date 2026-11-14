# AZ Navigation & Naming Decision

**Status:** Founder-approved product and UX direction  
**Approved:** 2026-11-14  
**Scope:** AZ Web V1 navigation labels, information architecture, and naming principles  
**Owner:** PSEVN

## 1. Primary navigation — five destinations

The V1 primary navigation contains exactly five destinations, in this order:

1. **Home** — the student's overview and starting point.
2. **Planning** — academic schedules, subjects, tasks, deadlines, and focus planning.
3. **Study** — the central study and learning environment.
4. **AZ Projects** — collaborative university and student projects.
5. **Profile** — represented visually by the student's profile image/avatar rather than a text label such as “Me”.

### Navigation behavior and presentation

- **Study** occupies the center position in the five-item navigation and may receive the clearest visual emphasis as the primary learning destination.
- Preserve the five-destination structure. Do not add AZ Intelligence/AZI as a sixth primary-navigation item.
- **Mobile — Core Academic Experience:** keep the five primary destinations in the bottom navigation. Do not add more primary slots; if additional destinations are introduced later, place them in a clearly labeled secondary destination such as “More”.
- **Tablet — Expanded Academic Experience:** retain the same five primary destinations and hierarchy, while allowing a more spacious layout and clearly organized secondary navigation where useful.
- **Desktop — Full Academic Universe:** retain the same five primary destinations and hierarchy, with room for an expanded, collapsible sidebar and additional secondary destinations when they are genuinely available and useful.
- These are responsive presentation principles, not separate product tiers or promises that future sections already exist. Screen size alone must not unlock, expose, or imply availability of a feature. Secondary destinations must follow their actual release status, permissions, and feature availability; “coming soon” concepts such as AZ Arena or AZ Community must not appear as live capabilities.
- The profile destination uses the student's avatar as its visible control. It must still have a meaningful accessible name (for example, “Profile”) for screen readers and assistive technology.
- Navigation labels and accessible names must be localized properly for Arabic RTL and English LTR. Do not hard-code English labels into layouts that bypass the localization system.

## 2. Naming decisions

- **AZ** remains the overall platform and brand name. It is not the name of the Study destination.
- Rename the former primary-navigation item **AZ** to **Study**.
- Keep **Planning** unchanged. It is clear, familiar, and accurately describes the destination.
- Keep **Home** and **AZ Projects** unchanged.
- Replace the visible text label **Me** with the user's profile image/avatar. “Profile” may be used as the semantic/accessibility label; it is not required as visible navigation text.
- Use a product-like, future-forward naming style for features inside AZ, while keeping primary navigation short and immediately understandable.
- **AZ Intelligence** remains the name of AZ's intelligence system/layer. **AZI** remains the personal academic companion identity. Neither is a separate primary-navigation destination; AZI can assist across relevant areas of the product.

## 3. What belongs inside Study

Study is the main environment for learning workflows, not merely a document library or a single PDF-upload screen. Its intended scope brings together the student's study materials and study actions, including applicable V1 capabilities such as:

- Study Packs built from the student's own materials.
- Summaries and material-grounded explanations.
- Flashcards.
- Practice questions and answer explanations.
- Exam Mode.
- Mistake review and weakness analysis.
- Ask Your Materials with source/page context where supported.

These are capability groupings, not a commitment that every item is already implemented or that every item must ship in the same release. Preserve the approved V1 scope and delivery priorities.

## 4. Internal feature naming direction

Use distinctive, product-like names for internal features where they improve identity and comprehension. The style should feel native to AZ's Academic Universe, but names must remain clear to students and must not become jargon.

Examples previously explored (not individually locked as final names):
- Study Packs
- Exam Arena
- Weakness Hunter
- Knowledge Space

“Flashcards” may remain a straightforward descriptive label if that is clearer. Do not rename or implement individual feature labels solely because they appear in this examples list; obtain founder approval for each material naming decision.

## 5. Implementation guardrails

This is a product/UX naming decision, not authorization for a broad redesign.

- Update the visible navigation label and associated localized strings from **AZ** to **Study** when the UI task is scheduled.
- Do not change routes, internal identifiers, database schemas, permissions, feature behavior, or analytics event names solely to match the visible label.
- Before changing a route or internal identifier, inspect references and add a deliberate migration/compatibility plan if one is actually needed.
- Keep AZ Intelligence/AZI distinct from the Study destination and avoid duplicate navigation.
- Preserve responsive behavior, keyboard navigation, focus states, accessible names, and Arabic RTL/English LTR support.
- Do not remove, hide, or silently relocate existing capabilities as part of this naming change.
- Treat this document as the source of truth for the navigation and naming decisions. If implementation details conflict with it, flag the conflict for founder review instead of guessing.

## 6. Acceptance criteria for the eventual UI change

- Exactly five primary destinations remain: Home, Planning, Study, AZ Projects, and the profile avatar.
- Study is the center destination in the five-item navigation.
- The former AZ navigation label is no longer displayed as the destination name.
- Planning remains Planning.
- The profile image/avatar is the visible profile control and has an accessible name.
- AZI remains an assistant/intelligence layer, not a sixth navigation item.
- English and Arabic labels, RTL/LTR layout, mobile, tablet, desktop, keyboard, and touch behavior are verified.
- No route, backend, database, or feature-scope changes are included unless separately approved.
