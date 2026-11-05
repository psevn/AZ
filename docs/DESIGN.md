# AZ Design Direction
**Status:** Approved design direction — foundation for future UI implementation  
**Scope:** AZ Web MVP and the design system that will extend across the product  
**Last updated:** 2026-11-05

## 1. Product design ambition — The Academic Universe

AZ is **The Academic Universe**: a future-forward academic environment where students organize, study, practice, review mistakes, and improve. The product should feel like entering a coherent academic world, not opening a conventional dashboard.

The visual direction should communicate space, discovery, progress, intelligence, and possibility. It must be distinctive to AZ, using the approved geometric AZ mark and its cyan/teal-to-blue-to-violet gradient family. The cosmic atmosphere is not a decorative campaign or a post-launch extra: its lightweight V1 expression is part of the product identity.

The goal is not to imitate Apple or another product. References to premium technology websites are about craft, restraint, clarity, and attention to detail — never about copying their layouts, visual signatures, or interactions.

**Design principle:** create a spacious, futuristic academic environment that feels effortless to use, while keeping learning workflows clear, calm, and fast.

### Approved V1 expression

- Dark-first interface and the official AZ visual identity.
- Lightweight 2D cosmic background and atmosphere.
- Ambient lighting, restrained glow, and controlled cyan/blue/violet gradients.
- Meaningful spatial depth through layered surfaces and a consistent elevation system.
- Purposeful transitions and micro-interactions.
- Reusable components and centralized design tokens.
- Full Arabic RTL and English LTR support, responsive behavior, accessibility, and reduced-motion alternatives.

V1 does **not** require a full 3D environment, WebGL, advanced cursor-reactive lighting, or interactive particle systems. These remain future enhancements. The cosmic identity, ambient lighting, gradients, and depth are V1 foundations, not deferred features.

### Experience intensity by area

- **Home:** expressive and atmospheric; the strongest sense of the Academic Universe.
- **Planning:** calm, structured, and organized; atmosphere stays in the background.
- **Focus:** minimal and distraction-free; motion and effects are reduced.
- **AZ Workspace:** focused and functional; document content and study actions remain dominant.

## 2. Known brand identity — preserve, do not invent

The approved AZ identity is associated with:
- The official geometric A/Z monogram.
- A cyan/teal through blue to violet gradient family.
- A dark-first visual direction.

Exact HEX/RGB values, gradient stops, logo clear-space, minimum sizes, and light/dark logo variants must be sampled and documented from the approved original logo asset before implementation.

Do not treat speculative color suggestions as official brand colors. Do not introduce unrelated accent colors without a clear semantic or accessibility reason. Student customization, when introduced, must use curated, coherent palettes that preserve readability and AZ's visual identity.

## 3. Core visual principles

### Cosmic academic atmosphere
- Establish a spacious, future-facing environment through restrained 2D cosmic backgrounds, ambient light, gradients, and subtle texture.
- The atmosphere should make AZ feel like an academic universe, not a generic black dashboard with decorative stars.
- Keep the visual environment behind the work: it must never compete with text, documents, questions, or controls.
- Use the strongest atmospheric expression on Home and a quieter treatment in Planning, Focus, and the Workspace.

### Premium & minimal
- Use deliberate spacing, alignment, proportion, and hierarchy.
- Remove visual noise; every element should earn its place.
- Prefer a few strong, consistent patterns over many decorative components.
- Use borders, shadows, blur, and gradients sparingly and with purpose.

### Distinctive AZ identity
- Build a recognizable visual language around the approved AZ mark and brand palette.
- Use brand gradients as intentional accents and ambient light, not decoration on every surface.
- Avoid generic dashboard templates and recognizable copies of other brands.
- Give AZ its own shape language, component details, and interaction character.

### Advanced, purposeful UI
- Use layered surfaces and spatial depth when they clarify relationships or actions.
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
- Never let decorative motion or layered surfaces obscure content or slow common actions.

## 4. Experience qualities

The AZ experience should communicate:
- **Clarity:** users understand where they are and what matters next.
- **Focus:** study and planning surfaces minimize distractions.
- **Control:** users can edit, reorder, retry, and recover without friction.
- **Progress:** meaningful progress is visible without gamification overload.
- **Trust:** AI outputs show their source pages where applicable; the interface never implies that generated questions predict a professor's actual exam.
- **Discovery:** the Academic Universe feels expansive and future-facing without overwhelming the student.
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
- Advanced pointer-reactive lighting, particles, and spatial cursor effects are future enhancements, not V1 requirements.

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

- Treat this file as the approved visual direction; it does not authorize changing product scope or backend architecture.
- Do not finalize brand color tokens until the original approved logo is sampled.
- Before selecting fonts, compare Arabic and English specimens in the actual interface.
- Create semantic design tokens first, then implement components against those tokens.
- Check every significant screen in Arabic RTL and English LTR, desktop and mobile, dark and light.
- Verify accessibility, responsive behavior, and production build after implementation.
- Prefer coherent reusable components over one-off styling.
- Keep backgrounds and visual effects isolated so they can be reduced or replaced without affecting academic workflows.
- Record material design decisions and implementation progress in GitHub so future contributors and AI tools can continue from the same source of truth.

## 10. Acceptance standard

A design pass is not complete merely because the page looks attractive in one screenshot. It should:
- Feel recognizably AZ and communicate The Academic Universe rather than a generic template.
- Use the approved logo and verified brand palette accurately.
- Establish the intended cosmic atmosphere, depth, and ambient lighting without visual noise.
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

## Future-Forward Web Experience Direction

This section records the product experience direction discussed with the founder. It is a design ambition and exploration brief, not permission to add every effect indiscriminately or a finalized implementation specification.

The goal is to make AZ feel like a product from the next generation of the web: exceptionally fluid, responsive, agile, immersive, and polished. The ambition is to exceed familiar premium-web expectations through AZ's own identity, not by copying Apple or another product.

### Experience pillars

1. **Fluidity** — Smooth, coherent transitions and immediate feedback. The interface should never feel heavy or sluggish.
2. **Spatial UI** — Meaningful depth, layered surfaces, and a clear sense of spatial presence. Layers must improve hierarchy and comprehension.
3. **Cosmic Atmosphere** — A restrained academic-universe environment built from 2D backgrounds, ambient lighting, and controlled gradients in V1.
4. **Cursor Interaction** — Advanced pointer-reactive lighting, particles, and spatial responses are future enhancements. V1 must remain fully usable without them.
5. **Micro-interactions** — Deliberate visual feedback for clicks, loading, success, completion, and other meaningful state changes.
6. **Intelligent Motion** — Motion should explain relationships, guide attention, communicate state, and support orientation; never motion for spectacle alone.
7. **Performance** — High perceived and actual speed, low resource use, and excellent usability on modest hardware as well as powerful devices.

### Design and engineering guardrails

- Preserve AZ's distinctive Academic Universe identity; do not imitate another brand's visual language.
- Keep academic work, reading, planning, and focus as the visual priority. Effects must not compete with content.
- The V1 cosmic atmosphere, ambient lighting, gradients, and layered depth must use lightweight techniques.
- Prefer subtle, purposeful motion over constant animation.
- Respect reduced-motion preferences and provide a complete usable experience without pointer effects, including on touch devices.
- Treat advanced cursor-reactive effects as post-launch progressive enhancements, not V1 requirements.
- Avoid expensive blur, large continuously animated surfaces, excessive DOM work, and unnecessary GPU effects.
- Keep interactions responsive under realistic low-end device and battery constraints; measure performance rather than assuming effects are cheap.
- Maintain accessible contrast, keyboard navigation, clear focus states, and predictable controls.
- Consider Arabic/RTL and English/LTR layouts in every motion and spatial interaction.
- Do not implement this entire direction as one large visual effect. Explore, prototype, test, and selectively adopt effects where they measurably improve the experience.

### Exploration status

The founder intends to collect more references and ideas before finalizing detailed web interactions. The Academic Universe concept and its lightweight V1 expression are approved; specific motion curves, durations, advanced pointer behavior, background techniques, component patterns, and performance budgets remain to be researched and agreed before implementation.
