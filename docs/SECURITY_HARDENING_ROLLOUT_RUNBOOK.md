# AZ Security Hardening Rollout Runbook

This runbook records the operational prerequisites for the document-processing and quiz-generation hardening stack. It is a checklist, not authorization to configure secrets, apply migrations, deploy Edge Functions, or change a live Supabase project.

## Current release boundary

- The security-hardening PR stack is review-only. PRs #74, #75, #76, #77, and #80 must not be treated as merged or deployed merely because their branches are mergeable.
- The intended stacked review order is #74 → #75 → #76 → #77 → #80. Re-check each PR's base/head relationship and CI after every merge; do not merge the superseded PRs #78 or #79 independently.
- Do not deploy `generate-quiz` or `process-document-pages` until the credit-reservation and rate-limit work has been reviewed, merged, and independently verified.
- The SQL files in `supabase/proposals/` are proposals, not migrations. In particular, `create_generated_quiz_rpc.sql` and `complete_generated_quiz_rpc.sql` must be converted into a reviewed, ordered migration before any function depending on those RPCs can be activated.
- Never apply these migrations to AZ-Staging or Production as part of this repository-only work. Use a disposable local PostgreSQL database for migration replay and SQL integration tests.

## Required server configuration inventory

Configure values only through the approved server-side Supabase configuration path. Do not put secrets in source control, browser code, `VITE_*` variables, screenshots, or issue comments.

| Setting | Required shape / purpose | Readiness rule |
|---|---|---|
| `ALLOWED_ORIGINS` | Comma-separated exact HTTP(S) origins; scheme and port included when applicable; no paths, trailing slash, or wildcard | Missing/invalid configuration intentionally fails closed with 503 |
| `OPENAI_API_KEY` | OpenAI secret for the Edge Function runtime | Server-side only; do not create or rotate it as part of this runbook |
| `OPENAI_MODEL` | Explicit model ID enabled on the owner's OpenAI account | No source-code default; missing value returns 503 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role credential for trusted Edge Function execution | Server-side only; never expose to the browser |
| `app_config.openai_model_pricing` | JSON object keyed by model ID; each model entry has non-negative `input_usd_per_1m` and `output_usd_per_1m` values | Must match the explicitly selected model; verify pricing against the provider's current published prices before activation |
| `app_config.document_limits` | JSON object keyed by plan; each plan defines positive `max_documents`, `max_pages`, `max_text_chars`, `max_active_uploads`, and `stale_uploaded_minutes` | Every plan used by a profile must have a complete, reviewed entry |
| `app_config.edge_rate_limits` | JSON object keyed by plan, then endpoint; each endpoint defines positive `max_requests` and `window_seconds` | Include every endpoint used by the deployed functions, including the separate `process_document_pages_save_pages` bucket |
| `app_config.global_monthly_cost_cap` | Positive numeric JSON scalar representing the monthly provider-spend ceiling in USD | Must be explicitly approved; zero/missing intentionally denies reservations |
| `public.credit_costs` | Base credit cost for `generate_quiz` | Must be present; request multiplier is applied by the reservation RPC |
| `public.usage_limits` | Daily and monthly credit allowances for each plan | Must be reviewed together with the credit-cost schedule |

The exact numerical quotas and budget are product/finance decisions. This runbook deliberately does not invent them.

## Migration and RPC dependency review

Before any deployment proposal is prepared:

1. Confirm the clean migration replay includes the pre-existing credit reservation RPC migration `20261105123204_credit_reservation_rpcs.sql`.
2. Review `20261112080000_scaled_quiz_credit_reservations.sql` against the exact signatures and behavior of the existing reserve, settle, and refund RPCs.
3. Review both generated-quiz SQL proposals together. The finalization RPC calls `create_generated_quiz` and the quiz settlement RPC inside one transaction; verify both function signatures, grants, ownership checks, idempotency behavior, and rollback semantics.
4. Review `20261112090000_document_upload_limits.sql` with the actual `documents` and `document_pages` schema and the atomic processing RPC.
5. Review `20261112100000_edge_function_rate_limits.sql` and verify that every deployed endpoint name matches the Edge Function call sites.
6. Ask the independent reviewer to approve the final migration order. Do not infer order from timestamp names alone.
7. Run a complete clean replay and all SQL verification scripts against a disposable database after the final migration sequence is assembled.

Do not run a partial migration sequence against a shared or live project.

## Verification gates

### Repository and CI

- All checks must run against the exact final PR head SHAs, not an earlier commit in the stack.
- A green workflow summary is insufficient if a required job is missing, skipped unexpectedly, or cannot be inspected.
- Preserve the run URL, commit SHA, job conclusion, and relevant failure excerpt in the review notes.
- If GitHub cannot provide job logs, record the result as **unverified**, not passed.
- Run the repository's relevant contract tests and build; report exactly which commands ran and their actual exit codes.

### Disposable PostgreSQL

- Run the clean migration replay from an empty disposable database.
- Run `supabase/tests/verify_quiz_credit_reservations.sh`.
- Run `supabase/tests/verify_document_upload_limits.sh`.
- Run `supabase/tests/verify_edge_rate_limits.sh`.
- Verify failed/timeout provider paths, duplicate request keys, concurrent reservations, rollback after settlement failure, and exact one-row usage logging.
- Never point these scripts at AZ-Staging or Production.

### Staging activation (separate approval required)

Only after code review, CI, migration replay, and the independent security review are complete should a separate staging change be proposed. That change must explicitly list:
- the exact migration files and order;
- the exact Edge Functions and versions to deploy;
- the server-side settings to configure (names only in review notes; never paste secret values);
- the expected behavior when each setting is missing;
- rollback steps and data compatibility considerations;
- a two-user isolation test plan covering document ownership, signed URL access, and quiz replay.

The current repository changes do not authorize any of these actions.

## Post-activation smoke-test checklist

When a separately approved staging rollout eventually occurs, verify each item with test accounts and non-sensitive fixtures:

- An unauthenticated request is rejected.
- A user cannot obtain a signed URL for another user's document.
- A user cannot write or read another user's extracted pages.
- Missing CORS allowlist fails closed; an unlisted browser origin is rejected.
- Document, page, text, and active-upload quotas are enforced under concurrent requests.
- Rate limits return 429 with a useful retry interval; unavailable rate-limit storage fails closed with 503.
- Missing model/pricing configuration prevents a provider call.
- Daily, monthly, and global spend caps deny generation before the provider call.
- A successful quiz is persisted once, charged once, and replayed from its saved payload.
- Failed generation and uncertain provider outcomes are reconciled without falsely reporting a confirmed zero cost or confirmed refund.
- Logs contain operational metadata only; no document text, bearer token, API key, or signed URL is logged.
- PDF page references remain labeled as unverified extraction references until server-side source verification exists.

## Change log

- 2026-11-12: Initial runbook added alongside the review-only security-hardening stack. No secrets, database settings, migrations, or deployments were changed.
