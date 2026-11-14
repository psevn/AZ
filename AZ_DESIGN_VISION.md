# AZ — Design Vision

**Status:** Approved — V1 Design Direction
**Product:** AZ by EZORD

## 1. Vision — The Academic Universe

AZ is **The Academic Universe**: a future-forward academic environment where students can plan, study, practice, review mistakes, and improve within one coherent digital world.

AZ should feel like entering a carefully designed academic universe, not opening a conventional study dashboard. The experience should communicate space, discovery, progress, intelligence, and possibility while remaining calm and useful for real academic work.

Its visual identity combines:
- A cosmic, spacious atmosphere.
- Advanced technology aesthetics.
- Meaningful depth, layered surfaces, and purposeful light.
- The official AZ geometric logo and its cyan, blue, and violet gradient.
- A distinctive academic character: futuristic, but never visually noisy or detached from learning.

**The Academic Universe is the guiding visual concept from V1.** It does not mean that V1 must contain a fully 3D world.


## 1.1 Brand Architecture — Two Roles, One AZ

AZ uses two complementary brand expressions. They are not competing names or interchangeable taglines; each has a distinct job.

- **The Academic Universe** — the official brand-world and positioning expression. Use it in the bio, formal brand descriptions, the website's About/brand story, presentations, and explanations of what AZ is building.
- **From A to Z** — the short, memorable marketing tagline. Use it in advertising, campaigns, social posts, video end cards, and quick brand recall moments.

Recommended relationship in extended brand copy:

**AZ — The Academic Universe**  
*A universe built for learning, growth, and achievement.*  
**From A to Z.**

Usage principles:
- Keep the official AZ monogram as the primary visual identifier; neither phrase replaces the logo.
- Use **The Academic Universe** when communicating the larger product vision and distinctive academic world.
- Use **From A to Z** when a short, repeatable campaign line or memorable sign-off is needed.
- The two expressions may appear together in brand introductions, but do not force both into every placement.
- Keep claims specific and honest: AZ supports learning and academic progress; it does not promise grades, guaranteed outcomes, or exam prediction.
- Treat this role split as the approved brand direction; detailed copy, localization, and campaign executions remain subject to testing.


## 2. V1 — Future-Forward Foundation

V1 must already feel like AZ and establish the Academic Universe atmosphere without compromising delivery, usability, accessibility, or performance.

V1 includes:
- Official AZ logo and visual identity.
- A dark-first interface with the approved AZ brand direction.
- Cyan, blue, and violet accents, with exact production values sampled from the approved logo asset.
- A lightweight 2D cosmic background that establishes atmosphere.
- Ambient lighting, restrained glow, and lively but controlled gradients.
- Visual depth through deliberate layers and spatially clear interface surfaces.
- Smooth, short transitions and meaningful micro-interactions.
- Pointer-reactive ambient lighting and restrained scene parallax on fine-pointer devices, with touch and reduced-motion fallbacks.
- A consistent elevation and surface system rather than generic cards everywhere.
- Centralized design tokens for colors, typography, spacing, surfaces, shadows, and motion.
- Responsive layouts for Arabic RTL and English LTR.
- Keyboard and touch usability, accessible contrast, and reduced-motion support.
- Lightweight, reusable components that keep visual effects separate from academic functionality.

V1 should express the Academic Universe consistently, while each area keeps the right level of visual intensity:
- **Home:** expressive, atmospheric, and welcoming.
- **Planning:** organized, calm, and clear.
- **Focus:** minimal, quiet, and distraction-free.
- **AZ Workspace:** focused, readable, and functional.

**V1 does not require WebGL, a full 3D environment, complex cursor-reactive particle systems, or heavy real-time rendering.** Lightweight pointer-reactive lighting, subtle parallax, and responsive hover feedback are included in the V1 experience. Advanced rendering is not.

## 3. Future — Expand the AZ Universe

Post-launch enhancements may include:
- Interactive 3D environments.
- Advanced spatial UI and immersive transitions.
- Advanced mouse/pointer-reactive particle systems and multi-layer spatial interactions.
- More dynamic cosmic environments and depth effects.
- Ultra / Balanced / Lite performance profiles.
- Student-selectable environments and visual effects.
- Optional sound design.
- Expanded personalization.

These are future opportunities, not V1 requirements. Each must be validated for student benefit, accessibility, and measurable performance before implementation.

## 4. Performance and Accessibility

- Performance takes priority over decoration.
- No forced 8K rendering or unnecessary high-cost effects.
- Adapt visual quality to screen size and device capabilities.
- Avoid expensive continuous animations.
- Keep Focus mode calm and distraction-free.
- Respect reduced-motion settings.
- Provide complete keyboard and touch experiences without pointer effects.
- Preserve usability on lower-end devices and mobile browsers.
- Keep content and controls legible above all backgrounds and effects.

## 5. Architecture

- Isolate backgrounds and visual effects in replaceable components.
- Centralize colors, typography, spacing, shadows, surfaces, and motion in design tokens.
- Keep components reusable and responsive.
- Never couple core academic functionality to decorative effects.
- Future visual upgrades must not require rebuilding core functionality.
- Treat advanced effects as progressive enhancements with safe fallbacks.

## 6. Experience by Area

| Area | Experience |
|---|---|
| Home | Expressive and atmospheric |
| Planning | Calm, structured, and organized |
| Focus | Minimal and distraction-free |
| AZ Workspace | Focused, readable, and functional |

## 7. Non-Negotiable Principles

1. AZ must have its own recognizable identity: The Academic Universe.
2. The V1 experience must visibly express the cosmic academic direction; it must not look like a generic dashboard.
3. Never sacrifice academic functionality for visual effects.
4. Never sacrifice performance or accessibility for decoration.
5. V1 must look intentionally designed, not temporary.
6. Keep the future AZ Universe architecturally possible.
7. Customization must preserve visual coherence, accessibility, and AZ's identity.

## 8. Scope Decision

**V1:** Establish The Academic Universe through a lightweight 2D cosmic atmosphere, ambient lighting, controlled gradients, spatial depth, layered UI, and purposeful micro-interactions.

**Post-launch:** Expand into immersive 3D, advanced cursor interactions, particle systems, performance profiles, and deeper personalization.

**Final principle: Build the Academic Universe from day one. Expand its dimensions progressively.**


## 9. Home & Navigation Reference Direction — Approved 2026-11-14

The founder approved three supplied screenshots as inspiration for AZ Home and its responsive navigation. They are references for usability, hierarchy, and layout—not templates to reproduce literally.

### Principles taken from the references
- A vertical sidebar/navigation rail on wider screens, with the AZ mark at the top.
- A clear selected state for the current destination.
- A spacious Home content area with a prominent **Today** heading and concise date/day and priority context.
- Readable task rows, clear completion controls, and satisfying completion feedback.
- A restrained dark interface with deliberate spacing and low visual clutter.

### AZ's distinct expression
AZ must go beyond the reference by combining its clarity with **The Academic Universe**: subtle cosmic atmosphere, ambient lighting, meaningful depth, and the official cyan/blue/violet identity. Green may communicate success or task completion, but it is not the primary AZ brand color.

AZ should feel more distinctive, comfortable, enjoyable, and engaging through its own typography, iconography, geometry, surfaces, and purposeful micro-interactions. It must remain calm and easy to understand. Do not copy exact component styling or add effects that distract from academic work.

### Responsive navigation decision
- **Mobile:** five primary destinations remain the long-term core: Home, Planning, AZ Intelligence, AZ Projects, and profile/avatar. Keep future areas from crowding this navigation.
- **Tablet:** use an adaptive compact or expanded navigation according to width and touch usability. Keep the five primary destinations clear; additional destinations are conditional on available space and a justified information architecture.
- **Desktop/laptop:** use a vertical sidebar or collapsible rail that can grow as AZ expands. AZ Arena and AZ Community may be added to wider-screen navigation when ready; they are not current mobile primary destinations.

All layouts must support Arabic RTL and English LTR, keyboard, mouse, and touch.

### Home experience intent
Home should help students identify their next useful action quickly. The Today pattern is a starting point, not a mandate to make AZ a generic task manager. The wider Home experience may organize today's priorities, upcoming/overdue work, the next exam, meaningful progress, and relevant AZI guidance without overcrowding the first viewport.

### Experience promises and guardrails
1. **Comfort:** clear hierarchy, readable typography, predictable navigation, balanced density, and accessible touch targets.
2. **Enjoyment:** brief, polished feedback and purposeful interactions that encourage progress without pressure or excessive gamification.
3. **Distinctiveness:** the result must be recognizable as AZ and not a generic dark productivity template.
4. **Calm:** effects remain behind the work; Planning stays structured and Focus stays distraction-free.
5. **Performance and accessibility:** lightweight effects, reduced-motion alternatives, accessible contrast, non-color status cues, and support for modest devices.
6. **No scope creep:** a visual reference does not authorize adding features, changing architecture, or copying another product's design.

**Implementation status:** the direction is approved. The current implementation has not been certified against these screenshots by this decision. The next step is to audit existing Home/navigation components, record concrete gaps, and implement improvements incrementally.
