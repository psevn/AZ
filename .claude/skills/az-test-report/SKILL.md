---
name: az-test-report
description: Use at the end of any AZ stage, slice or PR that changes behavior. Produces the test report required by SPEC §15 (what changed, what was tested, results, gaps) and keeps "works" tied to a test that actually ran.
---

# AZ test report

AZ's rule (SPEC §15): **"works" only with a test that ran.** A stage closes only when its tests pass, a report exists, and the reviewer (ChatGPT) has checked security, permissions and cost. Use this format in the PR description or in `docs/reports/<stage-or-slice>.md`.

## 1. Evidence rules
- Claim only what you ran. Quote the command and its real result (pass counts, errors). If you could not run something, write "not run" and why.
- Distinguish: **verified** (ran and passed), **partly verified**, **not verified**, **assumed**. Never use "should work" as a result.
- Re-run the checks on the final commit, not on an earlier one.
- Do not claim a feature is deployed unless you opened the deployed URL and exercised it.

## 2. Standard checks (run what applies)
1. **Build and types:** `npm run build` (this runs `tsc --noEmit` then `vite build`).
2. **Isolation tests:** use `az-rls-isolation-tests` for any table, view, RPC or storage change.
3. **Credit and cost tests:** use `az-ai-cost-gate` for any AI call (mock-provider concurrency tests).
4. **Migration replay:** use `az-db-migration` when migrations change.
5. **UI checks:** open the real pages in a browser at phone and desktop widths, in Arabic (RTL) and English, light and dark. Save screenshots (`deviceScaleFactor: 2` for ones a person will review). Exercise the actual flow from the interface (create, edit, delete, error state, empty state), not only that the page renders.
6. **Secrets:** confirm no key or token appears in the repo, the built bundle, logs or screenshots.
7. **Docs:** run `az-doc-consistency` if any decision, price, scope or status text changed.

## 3. Report template
```
# Report: <stage / slice / PR>   Date: <YYYY-MM-DD>   Commit: <sha>
## Changes
- <what changed, in plain words>
## Tests run
| Check | Command / method | Result | Verified? |
## Not tested / known gaps
- <item and reason>
## Risks and open questions for PSEVN
- <item>
## Cost impact
- <AI calls added, expected cost per operation, or "none">
## Rollback
- <how to undo; migrations are reverted with a new migration>
```

## 4. Closing rule
If any required check failed or was not run, the report says the stage is **not closed**. Do not soften this. List what is needed to close it.
