# AZ Web Design — World-Class Plan

**Status:** Proposed by Claude on 2026-11-10 at the owner's request; step 1 (visual QA) implemented on branch `design/visual-qa-pipeline`.
**Goal:** reach the product craft of the best AI/productivity apps (Claude, ChatGPT, Notion) and then surpass them where AZ has a real edge. We learn their *patterns*; we do not copy their exact layouts, assets or branding.

## Diagnosis (why AZ does not yet feel like them)
1. **No design system.** Each page was designed separately (hero card, long forms, repeated headings, uppercase eyebrows, mixed button styles). `src/styles.css` is >60 KB and growing by layering.
2. **Missing micro-quality:** skeleton loaders, useful empty states, undo, 150 ms transitions, visible focus rings, keyboard shortcuts, command palette.
3. **Perceived speed:** optimistic UI, no layout jumps, performance budget measured on a low-end device (owner: Windows 10, 3.76 GB RAM).
4. **The core moment is unfinished:** PDF → Study Pack (summary + questions with page references) is what convinces a student, not the shell.
5. **Nobody sees the result.** The AIs write CSS blind; the owner corrects by screenshots. There is no automated visual review.

## AZ's real edge (where we can beat them)
- **Arabic/RTL excellence** (typography, digits, alignment, mobile) — weak in most global apps.
- **Academic context:** Qatar course catalog, timetable, exam countdown, tasks linked to files.
- **Answers with page references** from the student's own files.
- **Mobile-first** for students.

## Plan (ordered, all free tooling)
| # | Step | Done when |
|---|------|-----------|
| 1 | **Visual QA pipeline**: demo mode (fixtures, build-time flag `VITE_DEMO=1`, never in production) + Playwright screenshots in GitHub Actions (desktop/mobile, EN/AR, dark/light, plain/universe) + report of console errors and horizontal overflow | CI artifact `visual-qa-screenshots` exists and is reviewed |
| 2 | **Design system**: one tokens file; 4/8 px spacing; type scale; 7 core components (Button, Input, Chip, Card, Tabs, Popover/Dialog, Toast) with all states; delete page-specific CSS | every page uses only these components |
| 3 | **Component gallery** page (internal) showing every component/state in EN/AR, dark/light | screenshotted by step 1 |
| 4 | **Interaction quality**: skeletons, empty states, undo, transitions, focus rings, shortcuts, Cmd/Ctrl+K | checklist passes |
| 5 | **Core loop polish**: PDF upload → Study Pack incl. loading/error/empty | recorded demo flow |
| 6 | **Arabic typography & RTL**: font metrics, digits setting, logical properties everywhere | RTL screenshots reviewed |
| 7 | **Performance budget**: LCP/INP/bundle size measured; low-end device test | budget documented and met |

## Review loop
Push → CI builds in demo mode → screenshots uploaded → Claude (and the owner) review the images → fixes → repeat. No UI change is called "done" without screenshots (EN+AR, dark+light, mobile).

## Rules
No redesign of the AZ identity (logo `public/az-mark.svg`, brand gradient #20E6F2 → #0879E8 → #2520D8 → #8A00E8). No removal of features. No merge to `main`, no deploy, no live-DB changes. Demo mode must stay build-time only and must never ship in a production build.
