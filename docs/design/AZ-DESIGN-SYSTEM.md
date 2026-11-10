# AZ Design System (step 2 of AZ-WEB-DESIGN-WORLD-CLASS-PLAN.md)

Files: `src/design/tokens.css` (type scale, touch size, focus ring, brand gradient), `src/design/components.css` (7 components), spacing/radius/motion tokens in `src/styles.css` (`--az-space-*`, `--az-radius-*`, `--az-motion-*`).

## Rules
- Minimum text size is 12px (`--az-text-xs`). The CSS was mechanically raised: every `font-size` below 12px (7–11px, or <0.75rem) became 12px. Check screenshots for overflow after changes.
- Scale: 12 / 13 / 15 / 17 / 20 / 28 / 36. Spacing: 4/8/12/16/24/32/48.
- Touch targets ≥ 44px on screens ≤ 767px. Visible keyboard focus ring on every interactive element (`:focus-visible`).
- Brand gradient only on primary actions, progress bars and the logo. Accent (cyan / blue in light) for active state.
- One component per job: `.az-btn` (+`--primary/--ghost/--danger`), `.az-input`, `.az-chip` (`aria-pressed`), `.az-card`, `.az-tabs/.az-tab` (`aria-selected`), `.az-popover`, `.az-toast` (`role="status"`).
- New UI must use these classes. Existing page CSS is migrated page by page (Planning first), then deleted. Do not add new page-specific one-off styles.
- Home orbit/planet art (`.home-universe-visual`) is removed: it rendered as a faint ghost in Universe mode.

## Status
Foundation only. Pages are not yet migrated to the components; no behaviour changed. Verified only by the visual-QA pipeline (see the CI artifact branch `visual-qa/<branch>`).
