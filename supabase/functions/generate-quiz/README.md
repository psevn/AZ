# AZI OpenAI quiz-generation foundation

This branch adds the first server-side generation slice. It is intentionally not deployed or activated.

## Runtime contract

- Edge Function: `generate-quiz` (POST, JWT verification remains enabled by Supabase's default).
- Request: `{ documentId, language: "ar" | "en", questionCount?: 5..20, topic?: string }`.
- The function verifies the bearer token with Supabase Auth, then reads only a ready document and its extracted pages under that user's JWT/RLS context.
- Input to OpenAI is bounded to at most 40 pages and 36,000 source characters. Page references are retained explicitly.
- OpenAI Responses API uses strict Structured Outputs. The model is configured by `OPENAI_MODEL` (default: `gpt-6-astra`).
- The generated output is validated again in application code. Invalid count, duplicate prompts/choices, invalid answer indexes, unsupported difficulty, or page references outside the selected document are rejected before storage.
- The browser response contains question prompts, choices, topics, source pages, and difficulty only. Correct indexes and explanations are written to `private.question_keys` and are never included in the response.

## Required server secrets (not created or configured)

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Edge Function runtime; `SUPABASE_PUBLISHABLE_KEY` is accepted as an alternative publishable key variable.

No key has been requested, created, or activated as part of this work. Never put OpenAI or service-role credentials in Vite `VITE_*` variables, browser code, or Git.

## Database prerequisite — proposal only

The Edge Function calls `public.create_generated_quiz` to atomically insert the quiz, visible question rows, and private answer-key rows. The proposed SQL is in:

`supabase/proposals/create_generated_quiz_rpc.sql`

This proposal has **not** been applied to any database. Until it is reviewed, converted into a proper migration, and explicitly approved/applied, the function will return a storage-not-ready error after generation. Do not deploy the function before the RPC exists.

The RPC grants execution only to `service_role`; it verifies document ownership and ready status again, validates each cited page, stores answer keys in the private schema, and returns a safe projection without keys or explanations.\n\nA second proposal, `supabase/proposals/secure_submit_answer_rpc.sql`, adds `public.submit_answer_safe` and revokes browser execution of the legacy key-bearing `public.submit_answer` entry point. It returns only correctness, explanation, and timestamp; it never returns `correct_index`. This is also proposal-only and must be reviewed together with any existing callers before adoption.

## Verification

Run:

```sh
npm run test:quiz-generation
```

The pure contract tests do not call OpenAI, Supabase, or the network. The Edge Function has not been deployed or exercised against a live project.

## Explicitly out of scope for this slice

- No API key creation, billing, or provider request.
- No Supabase migration application or live database write.
- No Edge Function deployment.
- No browser-side answer keys.
- No attempt creation/submission/review UI wiring yet. That is a separate follow-up after the database RPC and the safe grading contract are reviewed.
- No exam prediction claims. Questions are grounded in the supplied pages only.

## Usage reservation and idempotency configuration

Before enabling the function, configure the following rows; the function intentionally has no embedded prices or credit amounts:

- `credit_costs.generate_quiz_base`: base credits per generated quiz.
- `credit_costs.generate_quiz_per_question`: additional credits per requested question.
- `credit_costs.generate_quiz_per_page`: additional credits per source page included.
- `app_config.openai_model_pricing`: JSON object keyed by the exact configured model name. Each model entry must contain numeric `input_per_million_usd` and `output_per_million_usd` values.

The function reserves credits and the estimated global spend before calling OpenAI, then settles using provider-reported token counts and actual configured model rates. Failures refund the reservation. The client supplies a UUID request key for each click. A completed replay returns the stored quiz; a concurrent replay receives HTTP 409 and must retry with the same request key. A new user click must use a new key.

The new reservation migration is source code only. It must be reviewed and replayed on a disposable local database before any deployment consideration. No migration or Edge Function is applied by this PR.
