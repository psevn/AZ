import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proposal = readFileSync(
  new URL("../supabase/proposals/create_generated_quiz_rpc.sql", import.meta.url),
  "utf8",
);
const finalizeProposal = readFileSync(\n  new URL("../supabase/proposals/complete_generated_quiz_rpc.sql", import.meta.url),\n  "utf8",\n);\nconst edgeFunction = readFileSync(
  new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url),
  "utf8",
);
const generation = readFileSync(
  new URL("../supabase/functions/_shared/quizGeneration.mjs", import.meta.url),
  "utf8",
);

test("proposal is explicitly non-deployable and uses the live quiz schema", () => {
  assert.match(proposal, /PROPOSAL ONLY/i);
  assert.match(proposal, /public\.quizzes\(user_id, document_id, mode\)/i);
  assert.match(proposal, /public\.quiz_questions\(/i);
  assert.match(proposal, /private\.question_keys\(/i);
  assert.doesNotMatch(proposal, /CREATE TABLE/i);
});

test("restricts execution to the trusted service role", () => {
  assert.match(proposal, /SECURITY INVOKER/i);
  assert.doesNotMatch(proposal, /SECURITY DEFINER/i);
  assert.match(proposal, /SET search_path = ''/i);
  assert.match(proposal, /REVOKE ALL ON FUNCTION public\.create_generated_quiz\(uuid, uuid, jsonb\) FROM PUBLIC, anon, authenticated/i);
  assert.match(proposal, /GRANT EXECUTE ON FUNCTION public\.create_generated_quiz\(uuid, uuid, jsonb\) TO service_role/i);
  assert.match(proposal, /d\.user_id = p_user_id[\s\S]*?d\.status = 'ready'/i);
});

test("enforces the 5–20 question contract and strict question shape", () => {
  assert.match(proposal, /jsonb_array_length\(p_questions\) not between 5 and 20/i);
  assert.match(proposal, /jsonb_object_length\(v_question\) <> 7/i);
  assert.match(proposal, /v_question - array\[[\s\S]*?'difficulty'[\s\S]*?\]/i);
  assert.match(proposal, /Duplicate question prompt/i);
  assert.match(proposal, /count\(distinct lower\(btrim/i);
  assert.match(proposal, /jsonb_array_length\(v_choices\) <> 4/i);
  assert.match(proposal, /Question cites a page outside the selected document/i);
});

test("keeps answer key and explanation private and omits them from returned JSON", () => {
  assert.match(proposal, /insert into private\.question_keys\(question_id, user_id, correct_index, explanation\)/i);
  const safeReturn = proposal.match(/v_safe_questions :=[\s\S]*?\$function\$/i)?.[0] ?? "";
  assert.match(safeReturn, /'source_page'/i);
  assert.match(safeReturn, /'difficulty'/i);
  assert.doesNotMatch(safeReturn, /'correct_index'|'explanation'/i);
});

test("Edge Function derives the owner from a verified JWT and uses server-only persistence", () => {
  assert.match(edgeFunction, /auth\.getUser\(token\)/);
  assert.match(edgeFunction, /const userId = authData\.user\.id/);
  assert.match(edgeFunction, /\.eq\("user_id", userId\)/);
  assert.match(edgeFunction, /createClient\(supabaseUrl, serviceRoleKey/);
  assert.match(edgeFunction, /adminClient\.rpc\("complete_generated_quiz"/);
  assert.match(edgeFunction, /correct indexes or explanations are sent to the browser/i);
  assert.doesNotMatch(edgeFunction, /return json\(200,\s*\{[\s\S]*?correct_index/i);
});

test("shared validator enforces matching text-size and count bounds", () => {
  assert.match(generation, /minQuestions: 5/);
  assert.match(generation, /maxQuestions: 20/);
  assert.match(generation, /prompt\.trim\(\)\.length > 2000/);
  assert.match(generation, /choice\.trim\(\)\.length > 500/);
  assert.match(generation, /topic\.trim\(\)\.length > 120/);
  assert.match(generation, /explanation\.trim\(\)\.length > 4000/);
});


test("quiz persistence and credit settlement are atomic in one service-role-only RPC", () => {
  assert.match(finalizeProposal, /PROPOSAL ONLY/i);
  assert.match(finalizeProposal, /public\.create_generated_quiz\(/);
  assert.match(finalizeProposal, /public\.settle_quiz_generation\(/);
  assert.match(finalizeProposal, /raise exception 'Quiz credit settlement did not succeed'/);
  assert.match(finalizeProposal, /returns table\(quiz_id uuid, questions jsonb, result_payload jsonb\)/i);
  assert.match(finalizeProposal, /GRANT EXECUTE[\s\S]*TO service_role/i);
  assert.doesNotMatch(finalizeProposal, /SECURITY DEFINER/i);
});
