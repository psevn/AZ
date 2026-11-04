# AZ Web Experience Specification

**Status:** Exploration in progress — not a finalized implementation specification  
**Scope:** AZ Web MVP  
**Owner:** AZ product founder  
**Last updated:** 2026-11-04  
**Related document:** [DESIGN.md](./DESIGN.md)

## Purpose

This document is the working research and specification space for the six detailed areas that will shape AZ's future-forward web experience.

The ambition is to make AZ feel exceptionally fluid, fast, agile, immersive, and carefully engineered while preserving its own identity. The goal is not to copy Apple or any other product.

This document intentionally separates:
- **Ideas:** possibilities worth exploring.
- **References:** websites, videos, screenshots, and interactions to study.
- **Decisions:** choices explicitly approved for AZ.
- **Implementation:** work that is ready to be built and tested.

Do not treat an idea or reference as an approved requirement. Do not change product scope, architecture, or brand identity based on this document without approval.

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
- Approved decisions: _None added in this section yet._

---

## 2. Motion System

**Goal:** Make the interface feel fluid and responsive, with motion that communicates meaning rather than delaying work.

### Areas to explore
- Motion principles and hierarchy.
- Duration ranges for micro, standard, and expressive transitions.
- Easing curves and spring behavior.
- Page and route transitions.
- Panel, modal, menu, tab, and disclosure transitions.
- Loading, success, error, completion, and progress feedback.
- Hover, pressed, focus, and drag feedback.
- Reduced-motion alternatives and interruption behavior.

### Questions to resolve
- Which transitions should feel nearly instantaneous?
- Where does motion help users understand spatial or state changes?
- Which actions should never be delayed by an animation?
- How should animations behave when users act rapidly or repeatedly?
- What is the fallback when reduced motion is enabled?

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: _None added in this section yet._

---

## 3. Cursor Experience

**Goal:** Use pointer interaction as subtle progressive enhancement on devices that support it.

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
- Never make pointer movement necessary to discover or operate a feature.
- Do not hijack the native cursor in ways that harm usability.
- Avoid high-frequency React state updates or expensive layout work for pointer tracking.
- Respect reduced motion and device capability; disable or simplify effects when appropriate.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: _Pointer-reactive behavior is an exploration direction, not yet a component-level requirement._

---

## 4. Background & Effects

**Goal:** Give AZ a subtle sense of atmosphere, depth, and spatial presence without competing with academic content.

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
- Content and controls must remain legible above all backgrounds.
- Avoid permanent high-intensity animation, excessive blur, and decorative motion during focus sessions.
- Prefer CSS and compositing-friendly techniques where practical; profile before adopting heavier rendering approaches.
- Effects must degrade gracefully on modest hardware and mobile devices.

### Evidence and decisions
- References: _To be collected._
- Open questions: _To be researched._
- Approved decisions: _A calm, dynamic background is an exploration direction; exact technique and scope remain open._

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
- Approved decisions: _None added in this section yet._

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
- Approved decisions: _Performance is a first-class requirement; numerical budgets remain to be defined._

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

This document is a research workspace until decisions are approved. When a section is ready:
1. Summarize the approved decisions.
2. Identify affected screens and reusable components.
3. Define acceptance criteria and test cases.
4. Update implementation tasks separately.
5. Implement incrementally and verify on real target devices.

Do not interpret the ambition to feel "better than Apple" as a literal benchmark or permission to sacrifice usability, accessibility, performance, or AZ's own identity.
