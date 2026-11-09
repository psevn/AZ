# Work in Progress — AZ Planning

## Current work
- Active stacked branch: `feature/planning-quick-add-date-parser`
- Parent branch: `feature/planning-quick-add` (PR #13, open draft; not merged).
- Current scope: Planning A1 only — Quick Add date parsing and preview regressions.
- No database schema, migration, RLS, policy, or live-database changes.

## Planning A1 — Quick Add date parsing
- Expanded deterministic Arabic/English relative-date parsing to include today, tomorrow, day after tomorrow, weekdays (including this/next weekday phrasing), and explicit day/month dates such as `15 Nov`.
- Added regression coverage for Arabic, English, and mixed-language phrases, including `بعد غد`, `day after tomorrow`, `الخميس`, and `this Thursday`.
- The existing Planning Quick Add preview already renders `quickPreview.dueDate`; the parser previously lacked day-after-tomorrow handling and did not consume weekday prefixes such as `this`. The updated parser returns the date used by that preview and removes the recognized date phrase from the title.
- Tests and build for this new A1 branch: not yet run locally. Parent PR #13 was verified by the owner on Windows on 2026-11-09: `npm run test:quick-add` passed 10/10 and `npm run build` completed successfully. Those results do not yet verify this branch's additional parser changes.
- Visual QA and EN/AR, dark/light, mobile screenshots for this branch remain pending.

## Deferred, not implemented
- A2 custom themed calendar and quick date chips.
- A3 readable weekday/date formatting across previews and task rows.
- A4 Qatar timezone-safe end-of-day persistence and regression tests.
- A5 calendar-library evaluation and licensing review.
- A6 shared date picker in the full task form and optional details panel.
- B1 catalog-to-user-subject flow investigation/report.
- B2 catalog subject picker and user subject creation.
- B3 subject chips in Quick Add and list filters.

## Safety / verification
- Do not merge to `main`.
- Do not deploy.
- Do not apply any migration or write to the live database.
- No browser/device visual QA is claimed until the owner supplies the requested screenshots.
