# AZ Design Direction
**Status:** Approved design direction — foundation for future UI implementation  
**Scope:** AZ Web MVP and the design system that will extend across the product  
**Last updated:** 2026-11-04

## 1. Product design ambition

AZ should feel like a premium, carefully engineered academic workspace: calm enough for focused study, capable enough for serious planning, and distinctive enough to be recognized as AZ.

The goal is not to imitate Apple or another product. References to premium technology websites are about craft, restraint, clarity, and attention to detail — never about copying their layouts, visual signatures, or interactions.

**Design principle:** make the product feel effortless on the surface, while the underlying system feels thoughtful, capable, and coherent.

## 2. Known brand identity — preserve, do not invent

The previously discussed AZ identity is associated with:
- An A/Z lettermark direction.
- A blue, teal, and purple gradient family.
- A dark academic interface direction.

These are qualitative identity references, not verified production color values. Exact HEX/RGB values, gradient stops, logo clear-space, minimum sizes, and light/dark logo variants must be sampled and documented from the approved original logo asset before implementation.

Do not treat earlier speculative color suggestions as official brand colors. Do not introduce unrelated accent colors without a clear semantic or accessibility reason.

## 3. Core visual principles

### Premium & minimal
- Use deliberate spacing, alignment, proportion, and hierarchy.
- Remove visual noise; every element should earn its place.
- Prefer a few strong, consistent patterns over many decorative components.
- Use borders, shadows, blur, and gradients sparingly and with purpose.

### Distinctive AZ identity
- Build a recognizable visual language around the approved AZ mark and brand palette.
- Use brand gradients as intentional accents, not as decoration on every surface.
- Avoid generic dashboard templates and recognizable copies of other brands.
- Give AZ its own shape language, component details, and interaction character.

### Advanced, purposeful UI
- Use layered surfaces and intelligent cards when they clarify relationships or actions.
- Establish depth through a consistent elevation system rather than random shadows.
- Use subtle transitions and responsive feedback to make the interface feel precise.
- Keep important information scannable; complexity must not become clutter.

### Typography
- Arabic and English must both feel first-class and professionally composed.
- Select typefaces only after testing real Arabic and Latin text together, including numerals, weights, punctuation, and mixed-language labels.
- Define a consistent type scale, line heights, weights, and hierarchy.
- Ensure RTL and LTR layouts are intentionally designed, not mechanically mirrored.
- Avoid cramped Arabic line spacing and inconsistent baseline alignment.

### Dark & light themes
- Design both themes as complete visual systems, not simple color inversions.
- Define semantic tokens for page backgrounds, elevated surfaces, text, muted text, borders, focus, and status colors.
- Maintain readable contrast, clear elevation, and restrained brand accents in both themes.
- Verify cards, forms, menus, dialogs, charts (if later added), and empty/error states in both themes.

### Functional beauty
- Visual design must improve studying, planning, focus, and review.
- Prioritize clarity, task completion, and low cognitive load over visual effects.
- Never let decorative motion or layered cards obscure content or slow common actions.

## 4. Experience qualities

The AZ experience should communicate:
- **Clarity:** users understand where they are and what matters next.
- **Focus:** study and planning surfaces minimize distractions.
- **Control:** users can edit, reorder, retry, and recover without friction.
- **Progress:** meaningful progress is visible without gamification overload.
- **Trust:** AI outputs show their source pages where applicable; the interface never implies that generated questions predict a professor's actual exam.
- **Consistency:** the same interaction behaves the same way across the product.

## 5. Layout and component direction

- Use a disciplined spacing scale and a consistent responsive grid.
- Keep navigation predictable and content widths comfortable for reading.
- Build reusable components with clear variants and semantic states.
- Cards should communicate a clear grouping or action; avoid wrapping every item in a card.
- Establish consistent patterns for buttons, inputs, tabs, menus, dialogs, badges, empty states, loading states, and errors.
- Use restrained radii and elevation with a clear hierarchy.
- On mobile, prioritize the core action and content; do not merely shrink the desktop layout.

## 6. Motion and interaction

- Motion should be subtle, short, and informative: state changes, navigation, feedback, and progressive disclosure.
- Avoid gratuitous parallax, long intro animations, and effects that delay interaction.
- Provide visible hover, pressed, focus, disabled, loading, success, and error states.
- Respect reduced-motion preferences.
- Keyboard navigation and clear focus indicators are required, not optional polish.

## 7. Accessibility and localization

- Maintain accessible contrast in both themes.
- Do not communicate status through color alone.
- Support keyboard operation and sensible focus order.
- Design RTL and LTR layouts deliberately, including icons, directional controls, tables, and mixed Arabic/English content.
- Keep layouts robust under longer Arabic labels and translated text.
- Use semantic HTML and accessible names for controls.

## 8. Product-specific design priorities

The visual system must serve AZ's core loop:

**Plan → Study → Practice → Review mistakes → Improve**

Prioritize the following surfaces in the design work:
1. Home: today's priorities, upcoming/overdue tasks, next exam, and meaningful progress.
2. Planning: subjects, tasks, deadlines, priority, duration, and clear Today / Upcoming / Overdue views.
3. Focus: a calm, low-distraction task-linked focus experience.
4. AZ workspace: PDF/document context, summaries, Ask, and Quiz.
5. Practice and review: readable questions, clear answer feedback, explanations, source pages, and mistake review.

The interface should make document-grounded AI work understandable and trustworthy. Never use wording or visuals that promise exam prediction.

## 9. Implementation rules

- Treat this file as the design direction; it does not authorize changing product scope or backend architecture.
- Do not finalize brand color tokens until the original approved logo is available and sampled.
- Before selecting fonts, compare Arabic and English specimens in the actual interface.
- Create semantic design tokens first, then implement components against those tokens.
- Check every significant screen in Arabic RTL and English LTR, desktop and mobile, dark and light.
- Verify accessibility, responsive behavior, and production build after implementation.
- Prefer coherent reusable components over one-off styling.
- Record material design decisions and implementation progress in GitHub so future contributors and AI tools can continue from the same source of truth.

## 10. Acceptance standard

A design pass is not complete merely because the page looks attractive in one screenshot. It should:
- Feel recognizably AZ rather than a generic template.
- Use the approved logo and verified brand palette accurately.
- Have a deliberate hierarchy and consistent component language.
- Work well in Arabic and English, RTL and LTR.
- Be polished in both dark and light themes.
- Remain responsive, accessible, and fast.
- Make the core academic workflows easier to understand and complete.

## 11. Open brand inputs

The following require confirmation from the original brand assets before being locked:
- Exact logo artwork and approved variants.
- Exact brand palette and gradient stops.
- Typeface choices and typography scale.
- Final shape, radius, shadow, and elevation tokens.

Until those inputs are verified, treat them as open design-system decisions rather than facts.
