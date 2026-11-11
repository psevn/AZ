import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL("../src/components/QuizPage.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
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

test("starts a quiz-backed daily challenge from its existing quiz without regenerating", () => {
  assert.match(page, /challenge\?\.id/);
  assert.match(page, /beginAttempt\(challenge\.quizId, challenge\.questionCount\)/);
  assert.match(page, /if \(demoMode \|\| qaState \|\| challenge\) return/);
  assert.match(page, /Number\(attempt\.question_count\) !== requestedQuestionCount/);
});

test("reports challenge completion only after a valid server-finished attempt", () => {
  const finishIndex = page.indexOf('rpc("finish_attempt"');
  const validationIndex = page.indexOf('result.total_questions !== questions.length', finishIndex);
  const receiptIndex = page.indexOf('rpc("complete_daily_challenge"', finishIndex);
  const callbackIndex = page.indexOf('onChallengeCompleted?.({', finishIndex);
  assert.ok(finishIndex >= 0);
  assert.ok(validationIndex > finishIndex);
  assert.ok(receiptIndex > validationIndex);
  assert.ok(callbackIndex > receiptIndex);
  assert.match(page, /challengeId: challenge\.id/);
  assert.match(page, /quizId,/);
  assert.match(page, /attemptId,/);
  assert.match(page, /finishedAt: result\.finished_at/);
  assert.match(page, /score: finalScore/);
});

test("Home selects only a ready document with an existing five-question quiz", () => {
  assert.match(app, /from\("documents"\)[\s\S]*?eq\("status", "ready"\)/);
  assert.match(app, /from\("quizzes"\)[\s\S]*?quiz_questions\(id\)/);
  assert.match(app, /available_question_count: questionRows\.length/);
  assert.match(app, /selectDailyChallenge\(\{ studyPacks/);
  assert.match(app, /setSection\("quiz"\)/);
});

test("Home retains challenge, quiz, and attempt IDs only after the QuizPage callback", () => {
  assert.match(app, /challengeId: string; quizId: string; attemptId: string/);
  assert.match(app, /onChallengeCompleted=\{\(completion\)=>setDailyChallengeCompletion\(completion\)\}/);
  assert.match(app, /dailyChallengeCompletion\?\.challengeId === dailyChallenge\.id/);
  assert.doesNotMatch(app, /awardPoints|grantPoints|points\s*\+=/i);
});
