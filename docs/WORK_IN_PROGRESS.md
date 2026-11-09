# Work in Progress — Calm Product UI

## Current branch

**Branch:** `feature/calm-ui-step1-fonts`  
**Merged design branch:** `design/calm-ui-step1`  
**Status:** Initial implementation updates are committed to this branch. A fresh local build and browser/device verification are still required.

### Completed in this branch
- Added Inter Variable and IBM Plex Sans Arabic self-hosted font imports.
- Installed `@fontsource-variable/inter` and `@fontsource/ibm-plex-sans-arabic`; updated package manifest and lockfile.
- Merged `design/calm-ui-step1` into this branch.
- Kept the approved `public/az-mark.svg` unchanged.
- Removed the literal backslash-n text between AZ module sections in `src/App.tsx`.
- Removed the duplicate profile-card title while retaining the page-level Me heading.
- Replaced the animated comet canvas with a lightweight three-layer starfield.
- Capped starfield rendering at 30 FPS, reduced canvas backing resolution, and stop/resume the animation when the document is hidden/visible.
- Added static, low-opacity corner glows to Plain mode for dark and light themes.
- Added subtle backdrop blur to key Universe-mode surfaces.

### Verification already performed
- Before the latest UI edits, `npm run build` passed locally after the merge and font installation (Vite production build completed; 67 modules transformed).
- Source inspection after the profile/JSX fix confirmed no remaining literal backslash-n sequences in `src/App.tsx` and confirmed the duplicate title is removed.

### Verification still required
- Pull the latest commits from this branch and rerun `npm run build`; the build has **not** been rerun after the recent App, canvas, and CSS changes.
- Browser checks for Arabic and English, dark and light themes, and responsive layouts.
- Screenshots for Home and Me in Plain and Universe modes.
- Measure rendering performance on the low-memory target device.
- Check text contrast (WCAG AA) on all cards and overlays in both themes.
- Complete the Home redesign: greeting, “What do you want to study today?” prompt, input, and quick actions while preserving existing functionality.
- Review sidebar details against the approved direction: logo, new-session entry, navigation, account area, and removal of decorative uppercase labels.
- Confirm the intended location of `docs/COLLABORATION.md`; it was not found at the repository root or under `docs/` on the checked branch.

### Safety boundaries
- No changes to `main`.
- No deployment.
- No migrations or writes to the live database.
- No PR opened and no claim of completed visual QA until the remaining checks pass.
