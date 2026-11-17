# AZ Web Experience Specification

**Status:** Exploration in progress — foundational visual direction approved; detailed implementation decisions remain open  
**Scope:** AZ Web MVP  
**Owner:** AZ product founder  
**Last updated:** 2026-11-05  
**Related documents:** [DESIGN.md](./DESIGN.md), [AZ_DESIGN_VISION.md](../AZ_DESIGN_VISION.md)

## Purpose

This document is the working research and specification space for the detailed areas that will shape AZ's future-forward web experience.

The ambition is to make AZ feel exceptionally fluid, fast, agile, immersive, and carefully engineered while preserving its own identity. The goal is not to copy Apple or any other product.

This document intentionally separates:
- **Ideas:** possibilities worth exploring.
- **References:** websites, videos, screenshots, and interactions to study.
- **Decisions:** choices explicitly approved for AZ.
- **Implementation:** work that is ready to be built and tested.

Do not treat an idea or reference as an approved requirement. Do not change product scope, architecture, or brand identity based on this document without approval.

## Approved foundational direction — The Academic Universe

The founder has approved **The Academic Universe** as AZ's guiding visual concept. AZ should feel like a spacious, future-forward academic world rather than a conventional dashboard.

### V1 — Future-forward foundation (approved)
- Lightweight 2D cosmic atmosphere/background.
- Ambient lighting, restrained glow, and controlled cyan/blue/violet gradients based on the approved AZ identity.
- Meaningful spatial depth and layered interface surfaces.
- Purposeful, short transitions and micro-interactions.
- A clear visual identity across Home, Planning, Focus, and AZ Workspace, with different levels of visual intensity.
- Responsive Arabic RTL and English LTR, keyboard and touch usability, accessible contrast, and reduced-motion support.

### Future — AZ Universe expansion (not V1 scope)
- Full interactive 3D environments and advanced spatial UI.
- Advanced pointer-reactive lighting, particles, and cursor-driven spatial effects.
- More dynamic immersive backgrounds and deeper personalization.
- Ultra / Balanced / Lite visual performance profiles and optional sound design.

The V1 cosmic atmosphere and visual depth are approved foundations, not features to postpone. Full 3D and advanced cursor effects remain future enhancements. This approval defines visual direction only; it does not expand the product's functional MVP scope or authorize implementation of every idea in this research document.

## How to use this document

For every proposed effect or pattern, record:
1. What the user sees and does.
2. What purpose it serves in the academic workflow.
3. A reference link or visual example, if available.
4. Expected behavior on desktop, touch devices, and keyboard.
5. Accessibility and reduced-motion behavior.
6. Performance cost and a way to test it.
7. Status: **Idea**, **Researching**, **Proposed**, **Approved**, **Rejected**, or **Implemented**.

Keep unresolved questions open. Prefer a small number of excellent, coherent interactions over a large collection of unrelated effects.

---

## 1. Visual Identity

**Goal:** Define the visual language that makes AZ recognizable, premium, calm, and distinct.

### Areas to explore
- Verified logo artwork, variants, clear space, and usage.
- Brand colors, semantic colors, and gradient behavior.
- Dark and light theme palettes.
- Arabic and English typefaces, weights, scale, and line heights.
- Shape language: geometry, radii, borders, and component silhouettes.
- Lighting, highlights, shadows, elevation, and material treatments.
- Icon style, illustration style, and data visualization language.
- Layout rhythm, spacing scale, and responsive grid.

### Questions to resolve
- Which colors are confirmed from the approved brand assets, and which are still proposals?
- How should the logo and gradient appear across dark and light themes?
- Which Arabic/Latin font pairing works best in real product screens?
- What visual details make AZ distinctive without adding noise?
- Which visual elements are global tokens versus special one-off treatments?

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: The Academic Universe concept and the lightweight V1 visual foundation above.

---

## 2. Motion System

**Status:** Proposed V1 foundation; detailed component rollout remains incremental.

**Goal:** Make AZ feel precise, responsive, and coherent. Motion must explain a state change, preserve spatial context, or provide feedback. It must never delay the student's work.

### Proposed V1 principles

1. **Purpose before spectacle.** Every animation must have a clear interaction or comprehension purpose. Decorative motion is limited to the quiet cosmic atmosphere.
2. **Immediate control.** Clicks, keyboard activation, form submission, navigation, and cancellation are never held until an animation finishes.
3. **Short and consistent.** Use the shared duration and easing tokens in `docs/MOTION_SYSTEM.md`; avoid one-off timing values for common interactions.
4. **State is truthful.** Loading, upload, extraction, success, and failure visuals reflect real application state. Never simulate upload or AI progress that the application cannot verify.
5. **Compositor-first.** Prefer opacity and transform. Do not animate layout dimensions, large blur surfaces, or expensive filters for routine UI feedback.
6. **Interruptible.** Rapid repeated actions must settle on the latest real state without queued or overlapping transitions.
7. **Accessible by default.** Respect `prefers-reduced-motion`, retain visible focus, and never communicate meaning through motion alone.
8. **Direction-aware.** RTL and LTR transitions must use logical direction and preserve the meaning of spatial relationships. Hover effects are enhancements, never the only feedback.
9. **Intensity follows context.** Home may be expressive; Planning stays calm; Focus is minimal; Study/Workspace prioritizes reading and source material.
10. **Progressive enhancement.** Touch, keyboard, reduced-motion, and modest hardware must receive a complete experience without pointer-reactive or continuous effects.

### Proposed V1 motion tokens

The initial shared tokens are defined in `src/styles.css` and documented in `docs/MOTION_SYSTEM.md`:

- Feedback: 120ms.
- Micro-interaction: 160ms.
- Standard content transition: 220ms.
- Emphasis transition: 280ms.
- Shared standard, enter, and exit easing curves.
- Small movement distances only; no spring physics or motion library in the V1 foundation.

These are starting system values, not a requirement to animate every component. A component may use no motion when immediate state feedback is clearer.

### Interaction rules

- Buttons: concise hover/pressed feedback; disabled controls do not move.
- Inputs: focus is immediate and clearly visible; no animated focus delay.
- Navigation: active state changes immediately; any future content transition must not block navigation.
- Menus, dialogs, tabs, and disclosure: animate only when it helps users understand appearance, dismissal, or hierarchy; support keyboard and rapid repeated activation.
- Lists and cards: animate only meaningful insertion, removal, or expansion; static informational cards do not react as if clickable.
- Upload and processing: distinguish selection, real transfer (if exposed), extraction, and server processing. Never invent a percentage.
- Success and error: show the result immediately; avoid celebratory or alarming motion.
- Focus sessions: no ambient movement, pulsing, or attention-seeking animation while the student is focusing.

### Reduced motion and interruption

When `prefers-reduced-motion: reduce` is active, CSS animations and transitions are disabled globally for the web UI. State changes, progress values, focus indicators, and status text remain available without movement. No essential information may depend on animation.

### V1 exclusions

- No full-page route-transition system in this foundation pass.
- No spring physics, scroll-jacking, parallax, cursor-following glow, animated pointer, or particle field.
- No new animation library.
- No continuous movement on routine workspace controls.
- AZI will receive a separately designed motion language later; this foundation does not prescribe an avatar animation.

### Verification requirements

Test desktop and mobile, Arabic RTL and English LTR, keyboard and touch, reduced-motion enabled, and a modest device profile. Confirm that rapid clicks are not blocked, focus remains visible, and the production build stays free of motion-related runtime errors.

### Evidence and decisions

- References and rationale are recorded in `docs/MOTION_SYSTEM.md`.
- Approved decisions: purposeful short transitions, shared timing/easing tokens, truthful state feedback, global reduced-motion fallback, and context-specific intensity.
- Implementation status: foundational tokens and baseline safeguards only; component-by-component adoption remains incremental.

## 3. Cursor Experience

**Goal:** Explore advanced pointer interaction as a future progressive enhancement on devices that support it.

### Areas to explore
- Pointer-following ambient light or glow.
- Cursor-reactive background gradients or visual fields.
- Subtle magnetic or proximity responses, only where useful.
- Hover depth and perspective on selected components.
- Pointer-aware highlights, borders, and focus cues.
- Custom cursor treatments, only if they improve clarity.
- Clear separation between pointer hover and actual click/tap behavior.

### Questions to resolve
- Which parts of AZ should react to pointer movement, and which should remain still?
- Should the pointer influence the global background, a local surface, or both?
- How subtle should the response be, and how quickly should it follow?
- How do we avoid distracting users while reading, studying, or focusing?
- What is the complete touch, keyboard, and no-hover equivalent?

### Guardrails
- Advanced cursor-reactive lighting, particles, and spatial pointer effects are post-launch ideas, not V1 requirements.
- Never make pointer movement necessary to discover or operate a feature.
- Do not hijack the native cursor in ways that harm usability.
- Avoid high-frequency React state updates or expensive layout work for pointer tracking.
- Respect reduced motion and device capability; disable or simplify effects when appropriate.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: Advanced pointer-reactive behavior is a future enhancement, not a V1 requirement.

---

## 4. Background & Effects

**Goal:** Give AZ a recognizable academic-universe atmosphere, depth, and spatial presence without competing with academic content.

### Areas to explore
- Static and gently animated ambient gradients.
- Pointer-responsive lighting fields.
- Layered backgrounds, depth, and parallax.
- Surface materials, translucency, blur, and glass-like treatments.
- Noise, texture, fine lines, and restrained patterns.
- Context-aware background changes across Home, Focus, and workspace.
- Dark/light theme behavior and contrast under effects.

### Questions to resolve
- What should the default background feel like before any interaction?
- Which effects belong globally and which belong only to selected screens?
- How do we preserve text readability and visual calm?
- Can the effect be rendered cheaply and paused when not visible?
- What does the experience look like with effects disabled?

### Guardrails
- The V1 cosmic atmosphere, ambient lighting, controlled gradients, and layered depth are approved foundations.
- Content and controls must remain legible above all backgrounds and effects.
- Avoid permanent high-intensity animation, excessive blur, and decorative motion during focus sessions.
- Prefer CSS and compositing-friendly techniques where practical; profile before adopting heavier rendering approaches.
- Effects must degrade gracefully on modest hardware and mobile devices.
- Full 3D environments, advanced cursor-reactive effects, and particle systems remain future enhancements.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: Lightweight 2D cosmic atmosphere, ambient lighting, restrained gradients, and meaningful depth are part of V1.

---

## 5. UI Experience

**Goal:** Translate the visual and interaction direction into a coherent, usable academic workspace.

### Areas to explore
- Navigation and information architecture.
- Home dashboard hierarchy and quick actions.
- Subject and task cards.
- Planning views, task editing, and prioritization.
- Focus timer and focus-session states.
- PDF/document workspace and source-page presentation.
- Summary, Ask, Quiz, results, and mistake-review flows.
- Buttons, inputs, menus, tabs, dialogs, toasts, and empty states.
- Responsive behavior across desktop, tablet, and mobile.
- Arabic RTL and English LTR component behavior.
- Skeletons, optimistic feedback, errors, and recovery.

### Questions to resolve
- What should users notice first on each major screen?
- Which actions should be one click away?
- Where are cards useful, and where is a simpler layout better?
- How should navigation adapt to smaller screens?
- How do motion, depth, and cursor effects support rather than obscure workflows?

### Guardrails
- Preserve the approved AZ V1 product scope.
- Do not add features just because a visual reference contains them.
- Keep study, planning, focus, and review workflows clear and efficient.
- Design every important state, not only the ideal populated screen.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: The Academic Universe is the visual direction; detailed screen layouts remain to be explored and approved.

---

## 6. Performance & Testing

**Goal:** Make the experience feel fast and remain reliable on modest devices, slower connections, and battery-powered hardware.

### Areas to explore
- Core Web Vitals and real-user performance measurement.
- Initial load, route transitions, and interaction latency.
- Bundle size, code splitting, lazy loading, and asset optimization.
- Animation profiling and compositor-friendly properties.
- Pointer event frequency and rendering strategy.
- Memory use, CPU/GPU load, and battery impact.
- Reduced-motion, low-power, and low-capability fallbacks.
- Responsive, accessibility, and cross-browser testing.
- Performance budgets and regression checks.

### Questions to resolve
- What devices and network conditions represent our minimum supported experience?
- Which performance metrics and budgets should block a release?
- How will we measure animation smoothness instead of judging by appearance alone?
- Which effects should automatically turn off under constrained conditions?
- How do we test Arabic/RTL and English/LTR across themes and screen sizes?

### Initial testing matrix
- Desktop with mouse and keyboard.
- Touch device without hover.
- Small and large viewports.
- Arabic RTL and English LTR.
- Dark and light themes.
- Reduced-motion enabled.
- Modest hardware and constrained network.
- Production build, not development mode only.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: Performance is a first-class requirement; numerical budgets remain to be defined.

---

## Research & Inspiration Log

Add one entry per useful reference. Capture the exact detail that is inspiring, not just the website name.

| Date | Reference (URL or asset) | What caught our attention? | Possible AZ use | Status |
|---|---|---|---|---|
| _—_ | _To be added_ | _—_ | _—_ | Idea |

## Decision Log

Only record a decision here after it has been explicitly approved.

| Date | Area | Decision | Reason | Status |
|---|---|---|---|---|
| 2026-11-04 | Overall direction | Explore a future-forward experience built around fluidity, spatial UI, cursor interaction, living backgrounds, micro-interactions, intelligent motion, and performance. | Founder-approved direction. | Approved |
| 2026-11-05 | Visual identity | Adopt **The Academic Universe** as AZ's guiding visual concept. V1 includes a lightweight 2D cosmic atmosphere, ambient lighting, controlled AZ gradients, spatial depth, layered surfaces, and purposeful micro-interactions. Full 3D, advanced cursor-reactive lighting, particles, and deeper environmental personalization remain post-launch. | Establish a distinctive future-forward identity in V1 without compromising delivery, accessibility, or performance. | Approved |
| 2026-11-17 | Motion foundation | Adopt shared V1 motion durations/easing, truthful state feedback, context-specific intensity, and a global reduced-motion fallback. | Make interaction feedback consistent without delaying academic work or excluding reduced-motion users. | Approved |

## Readiness Checklist

Before a section is considered ready for implementation:
- [ ] Its purpose and user benefit are clear.
- [ ] Useful references have been reviewed.
- [ ] Proposed behavior is described precisely.
- [ ] Desktop, touch, keyboard, RTL, and LTR behavior are considered.
- [ ] Accessibility and reduced-motion behavior are defined.
- [ ] Performance implications and test methods are documented.
- [ ] Open questions are resolved or explicitly accepted as implementation risks.
- [ ] The founder has approved the relevant decisions.

## Implementation Handoff

This document is a research workspace for detailed effects and interactions. The foundational Academic Universe direction above is approved. When a detailed section is ready:
1. Summarize the approved decisions.
2. Identify affected screens and reusable components.
3. Define acceptance criteria and test cases.
4. Update implementation tasks separately.
5. Implement incrementally and verify on real target devices.

Do not interpret the ambition to feel "better than Apple" as a literal benchmark or permission to sacrifice usability, accessibility, performance, or AZ's own identity.
