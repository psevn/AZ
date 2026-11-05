# ChatGPT independent review — Claude live-schema audit

Date: 2026-11-05  
Review branch: `chatgpt/review-live-schema-audit`  
Reviewed branch: `audit/live-schema-tests`  
Status: Independent review notes; no merge and no live database changes.

## Executive summary

Claude's audit is a useful and generally careful piece of engineering work. The strongest parts are the explicit separation between a reconstructed schema snapshot and original migration history, the two-user RLS/ownership test approach, and the clear statement that local stubs do not replace tests against real Supabase Auth and Storage.

I recommend keeping the audit and its test harness, with the follow-ups below. I do **not** recommend treating the report's current status statements as fully up to date until the migration and PR bookkeeping are reconciled.

## Findings

### 1. The live `submit_answer` fix is already applied — report is stale

I queried the live Supabase migration history and inspected the live `private.submit_answer` definition read-only.

Observed live state:
- Migration history contains version `20261105073535`, name `fix_submit_answer_ambiguous_created_at`.
- The live function's `INSERT ... RETURNING` clause uses the `quiz_attempts` alias (`qa.id, qa.created_at`), matching the proposed fix's substantive change.
- The live project currently has zero auth users, quiz questions, quiz attempts, or documents.

This conflicts with the audit report, which says the fix is proposed and **not applied**. The report may have been accurate when first written, but it is stale now.

**Required follow-up:** reconcile the report with the live migration record and preserve the exact SQL that was applied in the repository's migration history. The branch currently stores the SQL under `supabase/proposed/20261105000001_fix_submit_answer_ambiguous_column.sql`, while the live migration is recorded under version `20261105073535`. Verify exact SQL and migration provenance before moving or copying anything into `supabase/migrations/`. Do not replay it against the live project.

### 2. The collaboration status says a PR is open, but no PR was found

`docs/WORK_IN_PROGRESS.md` says the audit branch has an open PR. The GitHub PR search for `psevn/AZ` returned no PR.

**Required follow-up:** either create the PR or change the status to say that the branch is awaiting review and no PR exists. This is documentation accuracy, not a code defect.

### 3. Test harness is Linux/PostgreSQL-specific

`supabase/tests/run_local.sh` explicitly requires Linux, PostgreSQL 16 binaries, root privileges, and `runuser -u postgres`. It uses a throwaway local cluster and port 54329. It is not a PowerShell/Windows-native test runner.

This is not inherently wrong, but the execution requirement should be prominent in the README or test instructions. For this project's current Windows development setup, do not imply the script can be run directly in PowerShell. If we later want a Windows path, document a tested WSL2 route separately rather than assuming it works.

### 4. Test coverage is useful but intentionally incomplete

The Python tests provide meaningful positive and negative controls for:
- two-user row isolation;
- cross-user composite foreign keys;
- client write restrictions;
- answer-key confidentiality and server-side grading;
- profile creation and allowed updates;
- database cascades;
- storage folder policy logic.

The audit correctly documents that this is a local PostgreSQL replica, not a real Supabase integration test. The following still need separate validation before beta:
- two real authenticated users through the Supabase API;
- real Storage uploads, MIME/size enforcement, signed URLs, and deletion;
- concurrency/idempotency and usage-credit reservation/refund behavior;
- PDF processing and end-to-end quiz creation.

The report's 115/3 and 118/0 figures are recorded results from Claude's runs. I reviewed the test code and report, but did not independently execute the Linux harness in this review.

### 5. Repeated submissions remain a product/security-design gap

The test explicitly confirms that the same question can be submitted repeatedly and the answer is returned after each submission. This appears consistent with the current function implementation, but it is not a complete quiz-attempt model.

**Recommendation:** resolve the attempt/session design against the approved SPEC before the quiz UI depends on this RPC. This is a design follow-up, not a reason to discard the current RLS audit.

### 6. Some conformance items are informational GAPs, not failing tests

The `t_spec_conformance()` section reports known schema differences as `GAP`, not `FAIL`. Some entries are intentionally unconditional descriptions of the observed baseline (for example the existing `notes` table and the 50 MB bucket setting). Readers should not interpret the number of GAPs as a count of broken security tests.

Keep the distinction explicit:
- PASS/FAIL = executable assertion result.
- GAP = difference or follow-up against the SPEC; it does not mean the test failed.

## What I consider good and should preserve

- The snapshot is labelled as a reconstruction, not original migration source.
- The tests use two users and positive controls, rather than only checking that requests fail.
- The harness runs against a local throwaway PostgreSQL instance, not the live Supabase endpoint.
- Storage API limitations and the lack of real-user integration tests are disclosed.
- The proposed SQL fix is narrow and table-qualifies the `RETURNING` columns without intentionally changing the function's business logic.

## Recommended next actions (in order)

1. Update the audit report's `submit_answer` status from “proposed/not applied” to the verified live state, and reconcile the migration file/version without replaying it.
2. Correct the stale “PR open” status in `docs/WORK_IN_PROGRESS.md`, or open a PR.
3. Keep the local test harness and add a clear Linux/WSL2 execution note.
4. Track the repeated-submission/quiz-attempt model as a SPEC-alignment decision before quiz UI integration.
5. Plan real Supabase API + Storage integration tests before inviting beta students.

## Review limits

- Read-only inspection of the live Supabase catalogs, migration history, function definition, and row counts.
- Static review of the Claude branch files listed in the audit.
- No SQL was applied; no live data was changed.
- The local test script was not executed as part of this review.
- No files on `main` or Claude's branch were modified.
