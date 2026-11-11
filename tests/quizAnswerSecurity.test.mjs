import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proposal = readFileSync(
  new URL("../supabase/proposals/secure_quiz_answer_response.sql", import.meta.url),
  "utf8",
);

test("removes the legacy browser RPC that returned correct_index", () => {
  assert.match(proposal, /DROP FUNCTION IF EXISTS public\.submit_answer\(uuid, smallint\)/i);
  assert.match(
    proposal,
    /REVOKE ALL ON FUNCTION private\.submit_answer\(uuid, smallint\)[\s\S]*?FROM PUBLIC, anon, authenticated/i,
  );
});

test("exposes only safe per-answer fields to authenticated callers", () => {
  const returns = proposal.match(/RETURNS TABLE \(([\s\S]*?)\)/i)?.[1] ?? "";
  assert.match(returns, /answer_id uuid/i);
  assert.match(returns, /is_correct boolean/i);
  assert.match(returns, /explanation text/i);
  assert.match(returns, /answered_at timestamptz/i);
  assert.doesNotMatch(returns, /correct_index/i);
  assert.match(proposal, /GRANT EXECUTE ON FUNCTION public\.submit_answer_safe\(uuid, smallint\)\s+TO authenticated/i);
  assert.match(proposal, /FROM PUBLIC, anon/i);
});

test("uses an explicit authenticated-user check and a hardened definer wrapper", () => {
  assert.match(proposal, /IF auth\.uid\(\) IS NULL THEN/i);
  assert.match(proposal, /LANGUAGE plpgsql[\s\S]*?SECURITY DEFINER/i);
  assert.match(proposal, /SET search_path = ''/i);
  assert.match(
    proposal,
    /FROM private\.submit_answer\(p_question_id, p_chosen_index\) AS result/i,
  );
  assert.match(proposal, /NOTIFY pgrst, 'reload schema'/i);
});

test("documents that this proposal does not create a quiz-session lifecycle", () => {
  assert.match(proposal, /does NOT create a quiz-session lifecycle/i);
  assert.match(proposal, /PROPOSAL ONLY/i);
});
