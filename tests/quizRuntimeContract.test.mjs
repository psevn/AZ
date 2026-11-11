import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL("../src/components/QuizPage.tsx", import.meta.url),
  "utf8",
);

test("generates a quiz from the selected ready document through the server function", () => {
  assert.match(page, /functions\.invoke\("generate-quiz"/);
  assert.match(page, /documentId:\s*selectedDocument/);
  assert.match(page, /status",\s*"ready"/);
});

test("starts and loads a complete server-owned attempt snapshot", () => {
  assert.match(page, /rpc\("start_attempt"/);
  assert.match(page, /from\("attempt_questions"\)/);
  assert.match(page, /quiz_questions\(id,prompt,choices,source_page,topic,difficulty\)/);
  assert.match(page, /rows\.length !== Number\(attempt\.question_count\)/);
});

test("submits answers to server grading and never carries an answer key in the browser", () => {
  assert.match(page, /rpc\("submit_answer"/);
  assert.match(page, /p_attempt_id:\s*attemptId/);
  assert.match(page, /p_question_id:\s*current\.id/);
  assert.match(page, /p_chosen_index:\s*selectedIndex/);
  assert.doesNotMatch(page, /correct_index/);
});

test("finishes attempts and reads the authoritative score from the server", () => {
  assert.match(page, /rpc\("finish_attempt"/);
  assert.match(page, /result\.correct_count/);
  assert.match(page, /result\.total_questions/);
  assert.match(page, /result\?\.score/);
});

test("keeps synthetic grading confined to explicit visual demo mode", () => {
  assert.match(page, /if \(demoMode\) \{[\s\S]*?const correct = questionIndex % 2 === 0/);
  assert.match(page, /if \(!supabase \|\| !attemptId\)/);
});
