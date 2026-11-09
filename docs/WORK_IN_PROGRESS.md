# Work in Progress — Calm Product UI

## Current branch

**Branch:** `feature/planning-quick-add`  
**Merged design branch:** `design/calm-ui-step1`  
**Status:** Iterative UI refinements are committed to stacked draft PRs. A fresh local build and browser/device verification are still required.

### Planning — Quick Add (PR 1)
- Added a deterministic, dependency-free quick-add parser for Arabic and English dates, subject tags, priority ranks, and duration tokens. Unknown words and unmatched subject tags remain in the task title.
- Preserved existing database priority encoding: stored `3` = high, `2` = medium, `1` = low. User-facing tokens map `!1` → stored `3`, `!2` → stored `2`, `!3` → stored `1`; `!4+` is normalized visibly to `!3` / low with a three-level note.
- Added a live preview of the exact title, subject, due date, duration, and priority sent to the existing `tasks` table. Defaults match the existing form (45 minutes, medium priority, no subject, no due date).
- Kept the existing full task form and all existing task fields/actions. No database schema, migration, RLS, or Supabase policy changes.
- Added Node built-in unit tests for Arabic, English, mixed-language, weekday/month dates, unknown tokens, defaults, and priority normalization.

### Completed in this branch
- Added Inter Variable and IBM Plex Sans Arabic self-hosted font imports.
- Installed `@fontsource-variable/inter` and `@fontsource/ibm-plex-sans-arabic`; updated package manifest and lockfile.
- Merged `design/calm-ui-step1` into this branch.
- Kept the approved `public/az-mark.svg` unchanged.
- Removed the literal backslash-n text between AZ module sections in `src/App.tsx`.
- Removed the duplicate profile-card title while retaining the page-level Me heading.
- Restored sparse ambient comets alongside the three-layer starfield in UniverseEffects; comets render on the existing background canvas behind application content.
- Capped animation at 30 FPS, reduced canvas backing resolution, and stop/resume both stars and comets when the document is hidden/visible; both respect `prefers-reduced-motion`.
- Added one static, low-opacity cyan corner glow (7%) to Plain mode for dark and light themes; the background remains fixed.
- Added subtle backdrop blur to key Universe-mode surfaces.
- Reworked the Home hero into a welcome and study prompt with quick task capture; submitting the prompt opens Planning with the text prefilled, while existing focus and planning shortcuts remain available.
- Added responsive styling for the Home study prompt in narrow layouts.
- Removed the duplicate Home page heading so the study prompt is the single primary heading.
- Reworked Home into a centered study prompt with quick actions and Today, Focus, and Upcoming exam cards. The exam card explicitly shows that no exam date is configured; no exam data model or write flow was added.
- Flattened the sidebar and neutralized the active state, removed decorative gradients and heavy shadows from key cards, clarified disabled primary buttons, and raised task form labels/fields to readable 13px sizing.
- Changed decorative uppercase eyebrow labels to normal case and made the Subjects count display the actual unpadded count.
- Simplified the sidebar: replaced decorative uppercase rail copy with the AZ mark, added a New session shortcut to Focus, and added an Account shortcut; the logo remains visible when the rail is collapsed.
- Removed the application topbar and its duplicate logo/settings controls; moved language, background, theme, and sign-out controls into Me. The floating email capsule was removed; account email remains in the sidebar and Me.
- Persisted the selected light/dark theme in localStorage under `az-theme`; existing `az-language` and `az-background` persistence remains in place.

### Verification already performed
- Added `npm run test:quick-add` using Node's built-in test runner. Parser tests are run independently in Node; the full Vite build and browser checks remain to be run locally.
- Source changes use only existing `tasks` columns; no database objects were changed.


- Before the latest UI edits, `npm run build` passed locally after the merge and font installation (Vite production build completed; 67 modules transformed).
- Source inspection after the profile/JSX fix confirmed no remaining literal backslash-n sequences in `src/App.tsx` and confirmed the duplicate title is removed.

### Verification still required
- Run `npm run build` locally on this branch; the GitHub connector cannot execute the repository build or browser. Build result remains unverified.
- Browser checks for Arabic and English, dark and light themes, and responsive layouts.
- Verify the Home prompt hierarchy and the Today/Focus/Upcoming exam cards; confirm the exam placeholder is clear and does not imply an exam has been scheduled.
- Verify the compact mobile menu button remains accessible and that all Me preference controls work and persist after refresh.
- Screenshots for Home and Me in Plain and Universe modes, including two Universe screenshots at least two seconds apart to verify comet movement.
- Measure rendering performance on the low-memory target device, including the restored comet layer.
- Check text contrast (WCAG AA) on all cards and overlays in both themes; AA has not yet been measured.
- Review the Home redesign visually in the browser and confirm keyboard/mobile behavior; quick capture currently pre-fills the Planning task title and does not create a task until the user submits the Planning form.
- Confirm that the topbar controls moved to Me work and persist across refresh; verify the mobile drawer trigger.
- Capture two Universe screenshots at least two seconds apart to verify comet motion; verify reduced-motion and hidden-tab pause behavior.
- Verify sidebar behavior visually in expanded/collapsed desktop mode and on mobile, including keyboard focus and account email truncation.
- Confirm the intended location of `docs/COLLABORATION.md`; it was not found at the repository root or under `docs/` on the checked branch.

### Safety boundaries
- No changes to `main`.
- No deployment.
- No migrations or writes to the live database.
- PR 1 is a draft; no merge to `main`.\n- No claim of completed browser/visual QA until the remaining checks pass.
