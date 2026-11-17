# AZ Motion System

**Status:** Proposed V1 foundation  
**Scope:** Shared web interaction language  
**Related:** [DESIGN.md](./DESIGN.md), [WEB_EXPERIENCE_SPEC.md](./WEB_EXPERIENCE_SPEC.md)

## 1. Purpose

Motion is part of AZ's interaction language, not decoration layered over the interface. It should make the product feel precise and responsive while keeping the student's attention on studying, planning, and progress.

AZ should borrow quality principles from excellent products—clarity, timing, continuity, and restraint—not copy another product's recognizable visual effects.

## 2. Motion principles

- **Meaningful:** communicate feedback, state, hierarchy, or spatial continuity.
- **Fast:** never delay an action or make the interface feel slower.
- **Quiet:** avoid bounce, overshoot, jitter, and unnecessary perpetual motion.
- **Consistent:** use shared tokens rather than arbitrary durations.
- **Truthful:** show only progress and states the application can verify.
- **Interruptible:** the latest user action wins; no animation queue should block interaction.
- **Accessible:** support reduced motion, keyboard, touch, and visible focus.
- **Contextual:** motion intensity follows the task, not the novelty of an effect.

## 3. Timing and easing tokens

| Token | Value | Intended use |
|---|---:|---|
| `--motion-duration-feedback` | 120ms | Immediate visual acknowledgement |
| `--motion-duration-micro` | 160ms | Hover, pressed, small control feedback |
| `--motion-duration-standard` | 220ms | Small content and surface transitions |
| `--motion-duration-emphasis` | 280ms | Larger panel or disclosure transitions, only when useful |

Shared easing:
- `--motion-ease-standard`: controlled ease for routine state changes.
- `--motion-ease-enter`: quick start with a soft settle; no spring overshoot.
- `--motion-ease-exit`: decisive exit without a long tail.

Movement distances:
- `--motion-distance-micro`: 2px.
- `--motion-distance-content`: 6px.

These are maximum starting guidelines, not a mandate to animate. Immediate state changes are preferable whenever motion adds no comprehension.

## 4. Interaction patterns

| Pattern | V1 behavior | Avoid |
|---|---|---|
| Buttons | Subtle hover and pressed response; action fires immediately | Large bounce, delayed click, movement while disabled |
| Inputs | Immediate focus ring and concise border feedback | Animated focus delay or color-only focus |
| Navigation | Active state updates immediately | Blocking page transitions |
| Cards | Motion only when the card is interactive or its content changes | Making static information appear clickable |
| Lists | Short opacity/transform for meaningful insertion/removal | Animating every row on every render |
| Dialogs/menus | Short enter/exit transition; preserve focus and dismissal | Trapping users behind an exit animation |
| Progress | Reflect actual progress and state | Fake percentages or indefinite celebratory loops |
| Success/error | Clear status appears immediately | Flashing, shaking, or excessive celebration |

## 5. Intensity by AZ area

- **Home:** may carry the strongest ambient identity, but movement remains slow and low contrast.
- **Planning:** calm and structured; prioritize task scanning and editing.
- **Focus:** static and distraction-free. No pulsing, orbiting, or decorative movement.
- **Study / Workspace:** document and question content remain dominant; transitions are limited to meaningful control and content state changes.
- **AZI:** future separate motion specification; do not make the assistant avatar constantly animate in V1.

## 6. Engineering rules

1. Prefer `transform` and `opacity` for routine transitions.
2. Avoid animating width, height, top/left, large shadows, filters, and backdrop blur for common interactions.
3. Do not add a motion library for this foundation.
4. Avoid high-frequency pointer tracking and scroll-linked animation.
5. Hover is optional enhancement; touch and keyboard users receive equivalent state feedback.
6. Use logical CSS properties and avoid assuming left-to-right direction.
7. Never use motion as the only status signal.
8. Keep all state changes functional when CSS motion is disabled.

## 7. Reduced motion

When `prefers-reduced-motion: reduce` is active:
- Disable CSS animations and transitions globally.
- Keep content, status labels, progress values, and focus indicators intact.
- Do not replace motion with flashing or rapid color changes.
- Ensure no interaction depends on an animation completing.

## 8. Performance and acceptance

A motion change is accepted only when:
- It improves clarity or feedback, not merely visual activity.
- It does not block repeated actions or keyboard input.
- It works in Arabic RTL and English LTR.
- It remains usable on touch devices and with reduced motion enabled.
- It avoids unnecessary layout work and large continuously animated surfaces.
- It has been checked on a modest device and in a production build.

## 9. Rollout order

1. Shared timing/easing tokens and reduced-motion baseline.
2. Shared buttons, inputs, and navigation.
3. Loading, success, error, and empty-state feedback.
4. Meaningful list, panel, and dialog transitions.
5. Carefully selected Home atmosphere refinements.
6. Separate AZI motion exploration after its V1 behavior is stable.

Do not introduce a global route-transition animation until navigation behavior, loading boundaries, and interruption handling have been separately evaluated.
