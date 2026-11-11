import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proposal = readFileSync(
  new URL("../supabase/proposals/azi_daily_challenge_completion.sql", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/20261111073233_azi_daily_challenge_completion.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/components/QuizPage.tsx", import.meta.url),
  "utf8",
);

test("completion receipt is proposal-only, owner-scoped, and idempotent per user/day", () => {
  assert.match(proposal, /PROPOSAL ONLY/i);
  assert.match(proposal, /unique \(user_id, challenge_date\)/i);
  assert.match(proposal, /unique \(user_id, challenge_id\)/i);
  assert.match(proposal, /unique \(attempt_id\)/i);
  assert.match(proposal, /foreign key \(document_id, user_id\)/i);
  assert.match(proposal, /foreign key \(quiz_id, user_id\)/i);
  assert.match(proposal, /foreign key \(attempt_id, user_id\)/i);
  assert.match(proposal, /enable row level security/i);
  assert.match(proposal, /using \(auth\.uid\(\) = user_id\)/i);
  assert.match(proposal, /on conflict do nothing/i);
});

test("server RPC accepts only a verified, finished, five-question practice attempt", () => {
  assert.match(proposal, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(proposal, /qa\.user_id = v_user_id/i);
  assert.match(proposal, /qa\.finished_at is not null/i);
  assert.match(proposal, /qa\.mode = 'practice'/i);
  assert.match(proposal, /v_attempt\.question_count <> 5/i);
  assert.match(proposal, /at time zone 'Asia\/Qatar'/i);
  assert.match(proposal, /v_expected_challenge_id/i);
  assert.match(proposal, /p_challenge_id <> v_expected_challenge_id/i);
  assert.match(proposal, /grant execute on function public\.complete_daily_challenge[\s\S]*to authenticated/i);
  assert.doesNotMatch(proposal, /insert into [a-z_.]*points|award_points/i);
});

test("QuizPage requests a durable receipt after finish_attempt and before reporting completion", () => {
  const finishIndex = page.indexOf('rpc("finish_attempt"');
  const receiptIndex = page.indexOf('rpc("complete_daily_challenge"', finishIndex);
  const callbackIndex = page.indexOf('onChallengeCompleted?.({', finishIndex);
  assert.ok(finishIndex >= 0);
  assert.ok(receiptIndex > finishIndex);
  assert.ok(callbackIndex > receiptIndex);
  assert.match(page, /p_challenge_id: challenge\.id/);
  assert.match(page, /p_document_id: challenge\.documentId/);
  assert.match(page, /p_quiz_id: quizId/);
  assert.match(page, /p_attempt_id: attemptId/);
  assert.match(page, /challengeSavePending/);
});

test("CLI-generated migration preserves the tested proposal SQL", () => {
  assert.match(migration, /Generated with Supabase CLI v3\.1\.0/);
  assert.match(migration, /full AZ migration baseline reconciliation is still required/);
  assert.doesNotMatch(migration, /PROPOSAL ONLY/i);
  assert.equal(
    migration.replace(/^-- Generated with Supabase CLI v3\.1\.0[^\\n]*\\n-- This migration is not deployed; full AZ migration baseline reconciliation is still required\\n/, ""),
    proposal.replace(/^-- PROPOSAL ONLY[^\\n]*\\n/, ""),
  );
});
