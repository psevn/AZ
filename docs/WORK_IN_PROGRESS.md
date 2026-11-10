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
- Added Node built-in unit tests for Arabic, English, mixed-language, weekday/month dates, unknown tokens, defaults, and all three priority levels.
- Owner verified the parent Quick Add branch on Windows on 2026-11-09: `npm run test:quick-add` passed 10/10 and `npm run build` completed successfully.

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
- Added `npm run test:quick-add` using Node's built-in test runner. The owner ran the script locally on Windows (10/10 passed) and confirmed the parent branch's Vite production build succeeded. The new A1 parser additions still require a fresh run.
- Source changes use only existing `tasks` columns; no database objects were changed.


- Before the latest UI edits, `npm run build` passed locally after the merge and font installation (Vite production build completed; 67 modules transformed).
- Source inspection after the profile/JSX fix confirmed no remaining literal backslash-n sequences in `src/App.tsx` and confirmed the duplicate title is removed.

### Verification still required
- Run `npm run test:quick-add` and `npm run build` locally on `feature/planning-quick-add-date-parser`; the parent branch passed, but this branch adds parser and test changes.
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


## Planning A1 — date parser follow-up (PR #14)
- Branch: `feature/planning-quick-add-date-parser`, stacked on `feature/planning-quick-add`.
- Added day-after-tomorrow parsing in Arabic and English (`بعد غد`, `day after tomorrow`), weekday phrase handling (`الخميس`, `this Thursday`, `الخميس القادم`), and tests for Arabic, English, and mixed-language input.
- The existing Quick Add preview reads `quickPreview.dueDate`; the parser returns the normalized ISO calendar date and removes the recognized date phrase from the title. The date display formatting remains unchanged and is tracked separately in A3.
- Five additional regression tests are included. No local run of these new tests or build is claimed yet.
- PR #14 is open as a draft against PR #13's branch. It is not merged.



## Planning parser and Qatar timezone — PR A1

- **Current implementation branch:** `feature/planning-parser-qatar-time` (stacked on `feature/planning-todolist-redesign`; PR #15 remains separate and unmerged).
- Reworked the rule-based Quick Add parser to normalize Arabic diacritics and common letter variants (`ا/أ/إ`, `ة/ه`, `ي/ى`) for matching while preserving the original text and removing only recognized token spans.
- Added Arabic/English/mixed parsing for today, tomorrow, day after tomorrow, weekdays, next week (Sunday), English and Arabic month dates, Arabic-Indic digits, priority tokens, minute/hour durations, and Arabic `ساعة`.
- Preserved unknown subject tags and unmatched words in the title. Priority encoding was checked against the existing parser contract: database value `3` = high, `2` = medium, `1` = low; `!1/!2/!3` map accordingly and values above 3 clamp to `!3` with `priorityNotice=true`.
- Added `src/lib/qatarTime.mjs`: Qatar-local date extraction and formatting via `Intl.DateTimeFormat({ timeZone: "Asia/Qatar" })`, timezone-independent calendar-day arithmetic, Sunday-first weekday calculation, and Qatar wall-clock-to-UTC conversion for `timestamptz`. Western digits are currently the single `NUMBERING_SYSTEM` constant.
- Updated Planning's date grouping and date-only due timestamp conversion to use Qatar time. A date-only due date at 23:59 Qatar is stored as 20:59Z on the same calendar date; this avoids the browser-local/UTC-midnight day-shift bug.
- Added 17 parser/timezone tests in `tests/quickAdd.test.mjs`, including the required boundary case `2026-11-15T22:30:00Z` → Qatar date `2026-11-16`.
- **Execution evidence:** I executed the actual parser/helper source and the 17 test cases in an isolated JavaScript runtime harness; result: **17 passed, 0 failed**. This was not `npm run test:quick-add` under Node's test runner.
- **Not yet verified:** owner-side `npm run test:quick-add`, `npm run build`, browser behavior in multiple host timezones, UI/RTL/mobile screenshots, Playwright flows, and CI. These are not claimed complete.
- No dependency added. No task-type column, SQL migration, RLS change, live database write, merge, or deployment.

## 2026-11-10 — Visual QA pipeline (Claude, branch `design/visual-qa-pipeline`, based on `feature/azi-intelligence-core`)
- Added `src/lib/demoSupabase.ts` (fixture client, only used when `VITE_DEMO=1` at build time), a 4-line switch in `src/lib/supabase.ts`, `scripts/visual-qa.mjs`, `.github/workflows/visual-qa.yml`, and `docs/design/AZ-WEB-DESIGN-WORLD-CLASS-PLAN.md`.
- **Not verified in the agent session** (npm registry blocked there): `npm run build`, the demo client against the real component tree, the screenshot script. CI results are the evidence; see the next entry.

## 2026-11-10 — Design system foundation (Claude, branch `design/design-system-step2`, based on `feature/azi-intelligence-core`)
- Added `src/design/tokens.css`, `src/design/components.css`, `docs/design/AZ-DESIGN-SYSTEM.md`; imported in `main.tsx`; raised all font sizes below 12px to 12px (mechanical, in styles.css and component CSS); hid the ghost orbit art on Home.
- Not migrated yet: pages still use their own classes. Evidence = the visual-QA run for this branch (see PR).
