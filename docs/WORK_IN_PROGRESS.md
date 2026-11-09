# Work in Progress — Calm Product UI

## Step 1: Self-hosted fonts and merge

**Branch:** `feature/calm-ui-step1-fonts`  
**Merged design branch:** `design/calm-ui-step1`  
**Status:** Code changes are on the working branch; local production build passed before the latest profile/JSX fix. Rebuild and browser verification are still required.

### Done
- Added Inter Variable and IBM Plex Sans Arabic font imports in `src/main.tsx`.
- Installed `@fontsource-variable/inter` and `@fontsource/ibm-plex-sans-arabic`; package manifest and lockfile were updated.
- Merged `design/calm-ui-step1` into this branch, preserving the font setup.
- Kept the approved `public/az-mark.svg` unchanged.
- Fixed the literal backslash-n text between AZ module sections in `src/App.tsx`.
- Removed the duplicate “My profile” heading from the profile card; the page-level heading remains.

### Verification
- `npm run build` passed locally after the merge and font installation (Vite production build completed; 67 modules transformed).
- The App.tsx fixes above were committed remotely after that build; **the build has not yet been rerun after those latest edits**.
- Source inspection confirms the duplicate profile-card heading is removed and the literal JSX text separators are no longer present.

### Not yet done / not verified
- Re-run `npm run build` after pulling the latest branch changes.
- Browser checks for Arabic and English, dark and light themes, and responsive layouts.
- Screenshots for Home and Me in Plain and Universe modes.
- Performance measurement on the low-memory target device.
- Review and implementation of the remaining Calm UI requirements: Plain corner glow, Universe star layers and 30 FPS cap, readable translucent content backing, sidebar label cleanup, and the revised Home study prompt/input experience.
- The requested `docs/COLLABORATION.md` was not found at the repository root or under `docs/` on the checked branch; confirm its intended location if still required.

### Safety boundaries
- No changes to `main`.
- No deployment.
- No migrations or writes to the live database.
- No claim of completed visual QA or PR readiness until the remaining checks pass.
