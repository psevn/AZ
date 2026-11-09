# AZ Web UI Direction V2 — "Calm Product UI"

**Status:** Proposed by PSEVN on 2026-11-09 — awaiting approval of the mockups in `mockups-v2/`. No app code has changed.
**Supersedes (if approved):** the "cosmic atmosphere" parts of `docs/DESIGN.md` §1 and the glow/space mood of `design/AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md`. Brand identity (AZ monogram + gradient) is unchanged.

## Why
The current web UI feels like a marketing page, not a daily tool. Causes found in `src/styles.css` / `App.tsx`:
1. Default Windows system font stack (`Segoe UI, Tahoma, Arial`), no chosen Arabic font.
2. Decoration competing with content: starfield, diagonal stripes, blurred ambient orbs, orbits/planet, pulsing eyebrows, gradients everywhere.
3. Home is a marketing hero, not an action ("What do you want to study today?").
4. Top bar instead of a sidebar; many bordered translucent panels, no clear hierarchy.
5. No single accent colour: cyan, blue and violet all compete.

## Direction
Modern AI-product pattern (sidebar + central composer + generous whitespace + neutral surfaces), expressed in AZ's own identity. We do **not** copy any other product's exact layout, assets or branding.

- **Surfaces:** neutral dark (`#0E1013` bg, `#0A0C0F` sidebar, `#15181D` cards), light theme warm neutral (`#F7F7F5`). One hairline border colour, no glow, minimal shadow.
- **Accent:** one colour — cyan `#67DBF3` (dark) / `#0A7C93` (light) — for primary actions and active state only. The AZ gradient appears only in the logo.
- **Type:** Inter (Latin) + IBM Plex Sans Arabic (Arabic) — both open-licence fonts per their projects (**[VERIFY]** licence text when added). Self-hosted via npm packages (`@fontsource-variable/inter`, `@fontsource/ibm-plex-sans-arabic`). Mockup renders Arabic with a fallback font; final Arabic look depends on the real font.
- **Layout:** 264px sidebar (new session, nav, recent), centred composer on Home, Today/Focus/Next-exam cards below. Study screen = document left, structured summary with page references right.
- **Motion:** only functional transitions; honour `prefers-reduced-motion`.
- **RTL:** logical properties only (`inline-start/end`), mirrored sidebar (see Arabic mockups).

## Mockups (static HTML, rendered with Chromium)
`mockups-v2/mock.html?s=home|study&lang=en|ar&theme=dark|light` and the PNG renders beside it. Content is sample data.

## Implementation plan (after approval, small PRs, no feature removed)
1. Tokens + fonts (replace palette variables; remove starfield/ambient/orbit CSS).
2. App shell: sidebar + responsive drawer.
3. Home → composer-first layout.
4. Restyle Planning, Library, Study, Projects on the same tokens.
5. Visual regression screenshots in CI (EN/AR, dark/light, mobile).
