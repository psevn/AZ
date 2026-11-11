import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proposal = readFileSync(
  new URL("../supabase/proposals/secure_quiz_answer_response.sql", import.meta.url),
  "utf8",
);

test("replaces the actual three-argument public grading RPC", () => {
  assert.match(proposal, /DROP FUNCTION IF EXISTS public\.submit_answer\(uuid, uuid, smallint\)/i);
  assert.match(
    proposal,
    /REVOKE ALL ON FUNCTION private\.submit_answer\(uuid, uuid, smallint\)[\s\S]*?FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(proposal, /p_attempt_id uuid[\s\S]*?p_question_id uuid[\s\S]*?p_chosen_index smallint/i);
});

test("returns no answer-key field and preserves practice/exam response semantics", () => {
  const returns = proposal.match(/RETURNS TABLE \(([\s\S]*?)\)/i)?.[1] ?? "";
  assert.match(returns, /is_correct boolean/i);
  assert.match(returns, /explanation text/i);
  assert.match(returns, /answered_at timestamptz/i);
  assert.doesNotMatch(returns, /correct_index/i);
  assert.doesNotMatch(returns, /answer_id/i);
  assert.match(proposal, /Exam mode intentionally returns NULL correctness/i);
});

test("uses a hardened authenticated wrapper around the existing private grader", () => {
  assert.match(proposal, /IF auth\.uid\(\) IS NULL THEN/i);
  assert.match(proposal, /LANGUAGE plpgsql[\s\S]*?SECURITY DEFINER/i);
  assert.match(proposal, /SET search_path = ''/i);
  assert.match(
    proposal,
    /FROM private\.submit_answer\([\s\S]*?p_attempt_id,[\s\S]*?p_question_id,[\s\S]*?p_chosen_index[\s\S]*?\) AS result/i,
  );
  assert.match(proposal, /GRANT EXECUTE ON FUNCTION public\.submit_answer\(uuid, uuid, smallint\)\s+TO authenticated/i);
  assert.match(proposal, /FROM PUBLIC, anon/i);
  assert.match(proposal, /NOTIFY pgrst, 'reload schema'/i);
});

test("reuses the database-owned attempt lifecycle without introducing tables", () => {
  assert.match(proposal, /does not add or duplicate tables/i);
  assert.doesNotMatch(proposal, /CREATE TABLE/i);
  assert.match(proposal, /PROPOSAL ONLY/i);
});
