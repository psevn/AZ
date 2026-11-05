# AZ — How the AI builders work together

Status: PROPOSED 2026-11-05 — takes effect once PSEVN approves. Context: PSEVN wants Claude and ChatGPT to both build, audit and read each other's work. Two builders can speed things up, but only if they cannot overwrite each other or change the live database without a trace. These rules exist because that already happened once: eleven migrations were applied to the live Supabase project while the SQL of five of them never reached the repository.

## Roles
- Both agents may write code, migrations and docs, and both review each other. Neither reviews its own change as the only check.
- **PSEVN decides.** He approves product/architecture changes, anything that touches the live database, and merges.
- Tools do not talk to each other. Coordination happens only through GitHub files and what PSEVN relays.

## 1. Work in branches and pull requests
- Never push directly to `main` (the first docs commits were the exception while the repository was empty).
- Branch names: `claude/<topic>` or `chatgpt/<topic>`.
- Every change is a pull request with a short test report: what changed, what was tested, the command/output, what was NOT tested.
- The other agent reviews before PSEVN merges. A review is recorded in the PR; disagreements are written down, not silently reverted.

## 2. One writer per area
- Before starting, add a line to `docs/WORK_IN_PROGRESS.md`: agent, area/files, branch, date. Remove it when merged.
- Two agents never edit the same files or the same database objects at the same time. If an area is taken, pick another or ask PSEVN.
- Two agents never push to the same branch.

## 3. Database changes (strictest rules)
1. **File first, then apply.** Write the migration file in `supabase/proposed/`, test it locally with `bash supabase/tests/run_local.sh`, get PSEVN's explicit approval in chat, apply that exact SQL, then move the file to `supabase/migrations/` using the version/name the project assigned. Commit in the same PR. No migration is ever applied without its source file in the repository.
2. **Never edit an applied migration.** Any change is a new migration.
3. **Never reconstruct missing originals** (the five foundation migrations) and label them as originals. The baseline snapshot in `supabase/baseline/` is a clearly-labelled reconstruction of the current state, not history.
4. **Only one agent applies migrations at a time**, and records version + name in `docs/IMPLEMENTATION_STATUS.md`.
5. Nothing destructive (drop, truncate, delete data) without PSEVN's explicit approval for that exact statement.

## 4. Claims need evidence
- "Works" means a test ran and its output is attached. Otherwise write "not tested".
- Security-relevant changes (RLS, grants, storage, grading, credits) require the isolation tests to pass: `bash supabase/tests/run_local.sh`.
- The local tests use a replica of the live schema; they do not replace a test with two real users against the real project and Storage API. Record which one was done.

## 5. Docs are the source of truth
- Change `docs/SPEC.md` / `docs/DECISIONS.md` first, then code. If code and docs disagree, stop and ask PSEVN.
- No secrets, keys or passwords in the repository, PRs, or chat. Browser code uses only the Supabase publishable key.
- No paid services, new scope, or new tools without PSEVN's explicit approval.
