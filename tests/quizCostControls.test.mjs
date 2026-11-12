import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [edge, migration, creditRpcs, persistence, client] = await Promise.all([
  readFile(new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261112070000_dynamic_quiz_credit_reservations.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261105123204_credit_reservation_rpcs.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/proposals/create_generated_quiz_rpc.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/components/QuizPage.tsx", import.meta.url), "utf8"),
]);

test("quiz generation authenticates and scopes the selected document to the caller", () => {
  assert.ok(edge.includes("auth.getUser(token)"));
  assert.ok(edge.includes('.eq("user_id", userId)'));
  assert.ok(edge.includes('.eq("status", "ready")'));
});

test("the existing reserve RPC runs before OpenAI and reads configurable credit costs", () => {
  assert.ok(edge.includes('rpc("reserve_credits"'));
  assert.ok(edge.indexOf('rpc("reserve_credits"') < edge.indexOf('fetch("https://api.openai.com/v1/responses"'));
  assert.ok(edge.includes("Math.ceil(sourceCharacters * 1.5)"));
  assert.ok(edge.includes("questionCount * 500"));
  assert.ok(edge.includes("p_feature: FEATURE"));
  assert.ok(creditRpcs.includes("from public.credit_costs"));
  assert.ok(creditRpcs.includes("for update"));
  assert.ok(edge.includes("openai_model_pricing"));
});

test("a per-click request key is bound to the full payload and successful replay returns the saved quiz", () => {
  assert.ok(client.includes("requestKey: crypto.randomUUID()"));
  assert.ok(migration.includes("request_payload_hash"));
  assert.ok(edge.includes("request_payload_hash: payloadHash"));
  assert.ok(edge.includes("previous.request_payload_hash !== payloadHash"));
  assert.ok(edge.includes('previous.status === "succeeded"'));
  assert.ok(edge.includes("loadReplay(adminClient, userId, previous.result_ref)"));
});

test("failures refund; success settles and logs provider token usage without source text", () => {
  assert.ok(edge.includes('rpc("refund_credits"'));
  assert.ok(edge.includes('rpc("settle_credits"'));
  assert.ok(edge.includes("input_tokens: inputTokens"));
  assert.ok(edge.includes("output_tokens: outputTokens"));
  assert.ok(edge.includes("cost_usd: actualCost"));
  assert.ok(!edge.includes('from("ai_usage_log").insert'));
});

test("generated question order is persisted for stable replay", () => {
  assert.ok(migration.includes("add column if not exists position_no"));
  assert.ok(persistence.includes("position_no"));
  assert.ok(edge.includes('.order("position_no", { ascending: true })'));
});
