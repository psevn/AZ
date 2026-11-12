import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [edge, migration, persistence, client] = await Promise.all([
  readFile(new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261112070000_dynamic_quiz_credit_reservations.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/proposals/create_generated_quiz_rpc.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/components/QuizPage.tsx", import.meta.url), "utf8"),
]);

test("quiz generation requires an explicit configured model", () => {
  assert.match(edge, /const model = Deno\.env\.get\("OPENAI_MODEL"\);/);
  assert.match(edge, /if \(!model\?\.trim\(\)\) return json\(503/);
  assert.doesNotMatch(edge, /OPENAI_MODEL"\) \?\?\s*["'][^"']+["']/);
});

test("quiz generation authenticates and scopes the selected document to the caller", () => {
  assert.match(edge, /auth\.getUser\(token\)/);
  assert.match(edge, /\.eq\("user_id", userId\)/);
  assert.match(edge, /\.eq\("status", "ready"\)/);
});

test("reservation precedes the OpenAI request and uses configurable credit and model pricing", () => {
  assert.match(edge, /rpc\\("reserve_credits"/);
  assert.ok(edge.indexOf('rpc("reserve_quiz_credits"') < edge.indexOf('fetch("https://api.openai.com/v1/responses"'));
  assert.match(edge, /estimatedTokens\\(sourceCharacters: number, questionCount: number\\)/);
  assert.match(edge, /credit_costs|p_feature: FEATURE/);
  assert.match(edge, /openai_model_pricing/);
});

test("reservation uses a unique request key bound to the exact quiz payload", () => {
  assert.match(client, /requestKey: crypto\.randomUUID\(\)/);
  assert.match(edge, /request_payload_hash|p_payload_hash/);
  assert.match(migration, /on conflict \(user_id, feature, request_key\) do nothing/);
  assert.match(migration, /request_key_payload_mismatch/);
  assert.match(edge, /r_status === "succeeded"/);
  assert.match(edge, /loadReplay\(adminClient, userId, reservation\.r_result_ref\)/);
});

test("failures refund; success settles and records provider token usage without source text", () => {
  assert.match(edge, /rpc\("refund_credits"/);
  assert.match(edge, /rpc\("settle_credits"/);
  assert.match(edge, /input_tokens: inputTokens/);
  assert.match(edge, /output_tokens: outputTokens/);
  assert.match(edge, /cost_usd: actualCost/);
  assert.doesNotMatch(edge, /\.insert\([^)]*(pageText|documentText|boundedPages)/s);
});

test("generated question order is persisted for stable replay", () => {
  assert.match(migration, /add column position_no/);
  assert.match(persistence, /position_no/);
  assert.match(edge, /order\("position_no", \{ ascending: true \}\)/);
});
