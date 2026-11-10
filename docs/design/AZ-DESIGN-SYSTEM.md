# AZ Core Component Foundation — Step 23

## Purpose
Introduce a small, consistent set of opt-in visual primitives on top of the shared tokens from Step 22. This step establishes the component layer without migrating existing pages or changing current interactions.

## Components
- `.az-btn`: default, primary, ghost, danger, disabled and hover/active states.
- `.az-input`: themed field, placeholder, hover and focus states.
- `.az-chip`: selectable filter with `aria-pressed` / `.is-active`.
- `.az-card`: shared surface, border, radius and elevation.
- `.az-tabs` / `.az-tab`: visual selected state driven by `aria-selected`.
- `.az-popover`: shared menu/popup surface; positioning and dismissal stay with the caller.
- `.az-toast`: shared notification surface; caller provides `role="status"` and `aria-live="polite"`.

## Accessibility and responsive rules
- Visible keyboard focus inside the AZ app shell.
- Minimum 44px touch height for buttons, inputs and tabs on small screens.
- Respect `prefers-reduced-motion`.
- Keep semantic behavior in React/HTML; CSS classes must not pretend to implement tab, popover, or toast behavior.

## Safety
- Existing page markup and CSS remain untouched; components are opt-in.
- No page migration, product-scope change, dependency, database, deployment, or main-branch merge.
- Visual QA must confirm that existing screens remain unchanged and the new primitives render in both themes and directions before acceptance.
