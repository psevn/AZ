import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const edgePath = new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url);
const edge = await readFile(edgePath, "utf8");
const clientPath = new URL("../src/components/QuizPage.tsx", import.meta.url);
const client = await readFile(clientPath, "utf8");
const migrationPath = new URL("../supabase/migrations/20261112080000_scaled_quiz_credit_reservations.sql", import.meta.url);
const migration = await readFile(migrationPath, "utf8");

test("requires an explicit account-configured OpenAI model", () => {
  assert.match(edge, /Deno\.env\.get\("OPENAI_MODEL"\)/);
  assert.match(edge, /if \(!model\?\.trim\(\)\) return json\(503/);
  assert.doesNotMatch(edge, /OPENAI_MODEL\)\s*\?\?\s*["'][^"']+["']/);
});

test("authenticates and checks document ownership before reserving or calling OpenAI", () => {
  const authIndex = edge.indexOf("auth.getUser(token)");
  const ownerIndex = edge.indexOf('.eq("user_id", userId)');
  const reserveIndex = edge.indexOf('rpc("reserve_credits"');
  const providerIndex = edge.indexOf('fetch("https://api.openai.com/v1/responses"');
  assert.ok(authIndex >= 0 && ownerIndex > authIndex);
  assert.ok(reserveIndex > ownerIndex);
  assert.ok(providerIndex > reserveIndex);
  assert.match(edge, /if \(!token\) return json\(401/);
  assert.match(edge, /Bearer\\s\+/);
  assert.match(edge, /if \(authError \|\| !authData\.user\) return json\(401/);
  assert.match(edge, /if \(!document\) return json\(404/);
});

test("uses a per-click idempotency key and replays the saved safe result", () => {
  assert.match(client, /const requestKey = crypto\.randomUUID\(\)/);
  assert.match(client, /requestKey\s*[,}]/);
  assert.match(edge, /reservation\.r_replay === true/);
  assert.match(edge, /prior\?\.result_payload/);
  assert.match(edge, /REQUEST_ALREADY_USED/);
});

test("refunds provider, validation, persistence, and settlement failures", () => {
  assert.match(edge, /provider_http_/);
  assert.match(edge, /generation_failed/);
  assert.match(edge, /await refund\(adminClient, userId, requestKey, "quiz_finalization_failed",/);
  assert.match(edge, /rpc\("refund_quiz_generation"/);
});

test("settles actual token usage and stores no source text in the usage result", () => {
  assert.match(edge, /p_input_tokens: inputTokens/);
  assert.match(edge, /p_output_tokens: outputTokens/);
  assert.match(edge, /p_actual_cost: actualCost/);
  assert.match(migration, /input_tokens = p_input_tokens/);
  assert.match(migration, /output_tokens = p_output_tokens/);
  assert.match(migration, /result_payload = p_result_payload/);
  assert.match(migration, /create function public\.refund_quiz_generation/);
  assert.match(migration, /settled_cost = sc\.settled_cost \+ p_actual_cost/);
  assert.doesNotMatch(edge, /console\.(?:log|error)\([^\n]*(?:openAIKey|boundedPages|document_pages)/);
});

test("uses configurable credit and model prices with per-question/page scaling", () => {
  assert.match(edge, /from\("app_config"\).*openai_model_pricing/s);
  assert.match(edge, /p_credit_multiplier: creditMultiplier/);
  assert.match(edge, /const creditMultiplier = questionCount \/ 8 \+ boundedPages\.length \/ 40/);
  assert.match(migration, /cc\.credits \* p_credit_multiplier/);
  assert.match(migration, /global_monthly_cost_cap/);
});

test("extends the existing reservation and settlement RPCs rather than replacing their accounting", () => {
  assert.match(migration, /private\.settle_credits\(/);
  assert.match(migration, /create function public\.reserve_credits\(/);
  assert.match(migration, /create function public\.settle_quiz_generation\(/);
  assert.match(edge, /rpc\("refund_credits"/); // refund stays on the established RPC
});
