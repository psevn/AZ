# AZ Home & Navigation — Implementation Audit

**Date:** 2026-11-14  
**Status:** Source-level audit completed; visual/runtime confirmation still required  
**Reference screenshots:** Three Home/sidebar screenshots supplied by the founder on 2026-11-14  
**Implementation snapshot inspected:** `design/az-step25-quiz-screen` at `78bd076df0719843745f73d110b93a02bc34760e`  
**Related decisions:** [AZ Home visual direction](./DESIGN.md#founder-approved-home-reference-direction--2026-11-14), [Navigation & Naming](../product/NAVIGATION-AND-NAMING.md) (draft PR #88 at audit time), [AZ Promo V5 reference](./AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md)

> This is a source-code and responsive-CSS audit, not a claim that the live/staging app was opened and visually inspected. The implementation snapshot is an open design PR branch, not `main`. Re-run visual QA and inspect real screenshots before accepting visual changes.

## 1. Executive assessment

AZ already has a meaningful foundation: a branded collapsible desktop rail, selected navigation states, a Home study launcher, task/progress panels, Arabic/RTL and English/LTR support, dark/light themes, and an optional lightweight Universe background.

The current Home does **not** yet match the newly approved Today reference composition. Its current center of gravity is a study-prompt/launcher, with quick actions, metric cards, progress, and a "Next step" task list. The reference instead leads with a direct Today heading, date/day and priority count, and a concise prioritized task list.

**Recommendation:** evolve the current Home incrementally. Do not replace the app shell or rebuild the design system.

## 2. What already matches the reference direction

| Reference principle | Current implementation evidence | Assessment |
|---|---|---|
| AZ logo at the top of the wider-screen rail | `rail-logo` renders `/az-mark.svg` in `workspace-rail` | Present |
| Vertical desktop sidebar | `workspace-rail` is a sticky rail beside `workspace-main` | Present |
| Collapsible navigation | `sidebarCollapsed`, `rail-collapse`, and collapsed rail CSS | Present |
| Clear active destination | `.primary-nav button.active` and active module styles | Present |
| Dark, calm layered surfaces | Shared theme/surface tokens and the Calm UI refinements | Present |
| Optional Academic Universe atmosphere | `az-background` preference and `UniverseEffects` canvas | Present |
| Useful Home context | Date, greeting, study prompt, task count, focus, upcoming exam, progress | Present, but hierarchy differs |
| Task rows and completion actions | `task-row` shows title, subject, duration, status, and Start/Complete action | Present, but not the reference checkbox interaction |

## 3. Concrete gaps against the new screenshots

### 3.1 Home hierarchy

Current Home:
- Shows the date and a welcome greeting.
- Leads with “What would you like to study today?” and a study-prompt input.
- Offers quick actions for Planning, Focus, and a short quiz.
- Shows three metric cards (today's task count, Focus, upcoming exam).
- Shows progress and a “Pick up where you left off” task panel.

Reference direction:
- Leads with a clear **Today** page title.
- Places day/date and a concise priority count immediately beneath it.
- Makes the task list the primary content, with visible completion controls.

**Gap:** AZ's current Home is a study launcher first and a daily-priority view second. The new direction should reverse that emphasis while retaining a compact route into study/AI actions.

### 3.2 Task selection and ordering

In the inspected snapshot, Home's next-step list renders `openTasks.slice(0, 4)`. The tasks are loaded in descending `created_at` order. The list is therefore not explicitly restricted to today's tasks and is not visibly sorted by due time or priority.

**Gap:** the “Today · N priorities” concept needs a deliberate definition. Do not simply rename the existing task count. Define which open tasks qualify as today's priorities and a stable ordering rule (for example: overdue first, then due today, then priority, with deterministic tie-breakers). Preserve the user's manual task organization if/when that is an approved Planning behavior.

The current task row uses a priority marker, metadata, status text, and a Start/Complete button. The reference uses a direct checkbox/check state. Consider a clear, accessible completion control with an adequate touch target and an explicit label; do not use color alone to communicate completion.

### 3.3 Navigation structure and labels

The inspected UI snapshot currently declares primary sections as `home`, `planning`, `az`, and `me`. The AZ section contains nested modules (Workspace, Notebook, Focus, Arena). The rail account control shows an avatar plus account/email text.

This does not yet match the newer founder-approved navigation decision recorded in draft PR #88:
1. Home
2. Planning
3. Study (replacing the former AZ primary label)
4. AZ Projects
5. Profile avatar

AZ Intelligence/AZI is an assistant/intelligence layer, not a sixth primary destination. AZ Arena and AZ Community must not be presented as live capabilities merely because a wider screen has room; secondary destinations depend on actual availability and release status.

**Gap:** the implementation snapshot predates the new five-destination naming/IA decision. Do not change route identifiers, database identifiers, or feature behavior merely to update visible navigation labels.

### 3.4 Mobile and tablet navigation

Current responsive behavior:
- Desktop uses a sticky vertical sidebar, with a collapse option.
- At tablet widths the sidebar remains visible in a narrower layout.
- At widths up to 760px the rail becomes an off-canvas drawer opened by a menu button, with a backdrop.
- The topbar is hidden in the authenticated workspace.

**Gap:** there is no five-destination bottom navigation in this snapshot. Mobile currently depends on a hamburger/drawer pattern. The newer navigation decision calls for five primary destinations in the mobile bottom navigation, while tablet and desktop may use more spacious/adaptive navigation. This is a structural change and deserves its own isolated UI implementation with keyboard, touch, safe-area, RTL/LTR, and viewport testing.

### 3.5 AZ identity and atmosphere

The Home JSX contains a decorative orbit visual, but the inspected stylesheet ends by hiding `.home-universe-visual`. The wider Universe background is optional and the canvas is mounted only when Universe mode is selected.

**Assessment:** the calm direction is working, but the Home currently has less visible AZ-specific atmosphere than the reference vision suggests. The solution is not to restore constant decoration everywhere. Add a small, recognizable AZ signature—such as restrained ambient light, a subtle branded progress motif, or a distinctive selected-state treatment—only where it improves orientation or delight. Keep Plain mode calm and Focus distraction-free.

## 4. Comfort, enjoyment, and performance

### Comfort — prioritize
- Clear Today heading and one obvious next action.
- More useful task hierarchy; show the most relevant priorities without forcing every metric above the fold.
- Consistent readable type, line height, spacing, and task-row density.
- 44px minimum touch targets for key controls.
- Keep Arabic RTL and English LTR layouts intentionally composed.
- Provide clear empty, loading, offline, and error states.

### Enjoyment — purposeful, not noisy
- Brief completion feedback (subtle check transition and a small progress update).
- Consistent hover, pressed, focus, and selected states.
- Small, encouraging progress cues without streak pressure or excessive gamification.
- A restrained AZ signature in the active navigation and selected Home elements.
- No long entrance animation, constant movement behind task text, or celebratory effects on every click.

### Performance — protect the existing foundation
- Keep the Universe canvas optional, behind content, and absent under reduced-motion preferences.
- The inspected canvas caps device pixel ratio at 1.1, throttles animation to about 30fps, pauses while the document is hidden, and reduces the number of stars/comets on compact screens.
- Avoid adding always-running animation or expensive blur to the task list.
- Prefer CSS transitions on opacity/transform for micro-interactions; measure rather than assume.
- Preserve a fully usable experience with Plain mode and reduced motion.

## 5. Recommended implementation sequence

1. **Navigation IA alignment:** implement the five approved destinations from the Navigation & Naming decision; keep AZI as an assistant layer, not a sixth nav item. Keep route/identifier changes out of scope unless separately justified.
2. **Responsive navigation:** retain the desktop collapsible rail; introduce the five-item mobile bottom navigation; define the tablet transition deliberately. Verify safe areas, RTL/LTR, keyboard focus, and touch targets.
3. **Home hierarchy:** make Today the primary heading, with date/day and a correctly defined priority count beneath it. Keep the study prompt/quick actions available but visually secondary.
4. **Priority task list:** define task inclusion and ordering, then present accessible completion controls and concise task metadata.
5. **Signature polish:** add limited AZ-specific visual character and short completion feedback after the hierarchy and interactions are correct.
6. **Visual QA:** capture Home and navigation in Arabic/English, dark/light, Plain/Universe, desktop/tablet/mobile, and reduced-motion states. Check overflow, focus visibility, and task completion interactions. Re-run the build and the full visual QA workflow on the final branch.

## 6. Acceptance criteria

- Home's first visual hierarchy clearly communicates Today, the date/day, and the number of priorities.
- The priority count matches the actual task-list inclusion rule.
- The first task list contains relevant priorities in a documented, deterministic order.
- Task completion is clear, accessible, and immediately reflected in the UI.
- Exactly five primary navigation destinations are present according to the current approved navigation decision: Home, Planning, Study, AZ Projects, and Profile avatar.
- Mobile uses the five-item bottom navigation; tablet adapts without crowding; desktop retains a collapsible rail.
- AZI is not duplicated as a sixth primary destination.
- AZ Arena/Community are not exposed as active capabilities before they are available.
- Arabic RTL and English LTR, dark/light, Plain/Universe, reduced motion, keyboard, and touch are verified.
- No backend, database, Supabase, deployment, or product-scope changes are included in the visual implementation.
- Build and visual QA pass on the final implementation branch.

## 7. Verification status and limitations

- This audit is based on reading `src/App.tsx`, `src/styles.css`, and `src/components/UniverseEffects.tsx` at the implementation snapshot stated above.
- The inspected Step 25 PR describes an earlier Visual QA run with 64 primary screenshots, 96 state screenshots, 16 component-state screenshots, and 56 quiz-state screenshots, with zero reported problems/overflow. Its PR description also states that the expanded quiz matrix was newer than that successful run and still needed a fresh CI run.
- Those results are historical PR-reported evidence, not a fresh run for this audit or proof that the latest navigation direction is implemented.
- The authenticated application was not opened in a live browser in this audit. Actual visual comparison on current staging/production remains outstanding.
- No application code, database, Supabase project, Cloudflare resource, or deployment was changed during this audit.
