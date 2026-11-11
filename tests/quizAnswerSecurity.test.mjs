import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261111090000_secure_quiz_answer_response.sql", import.meta.url),
  "utf8",
);

test("removes the legacy browser RPC that returned correct_index", () => {
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.submit_answer\(uuid, smallint\)/i);
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION private\.submit_answer\(uuid, smallint\)[\s\S]*?FROM PUBLIC, anon, authenticated/i,
  );
});

test("exposes only safe per-answer fields to authenticated callers", () => {
  const returns = migration.match(/RETURNS TABLE \(([\s\S]*?)\)/i)?.[1] ?? "";
  assert.match(returns, /answer_id uuid/i);
  assert.match(returns, /is_correct boolean/i);
  assert.match(returns, /explanation text/i);
  assert.match(returns, /answered_at timestamptz/i);
  assert.doesNotMatch(returns, /correct_index/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_answer_safe\(uuid, smallint\)\s+TO authenticated/i);
  assert.match(migration, /FROM PUBLIC, anon/i);
});

test("keeps the existing private grader as the sole grading source", () => {
  assert.match(
    migration,
    /FROM private\.submit_answer\(p_question_id, p_chosen_index\) AS result/i,
  );
  assert.match(migration, /SECURITY DEFINER/i);
  assert.match(migration, /SET search_path = ''/i);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);
});

test("documents that this migration does not create a quiz-session lifecycle", () => {
  assert.match(migration, /does NOT introduce a quiz-session lifecycle/i);
  assert.match(migration, /one row per answer/i);
});
