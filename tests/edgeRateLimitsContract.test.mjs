import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const paths = {
  upload: "../supabase/functions/create-document-upload-url/index.ts",
  signed: "../supabase/functions/create-document-signed-url/index.ts",
  processing: "../supabase/functions/process-document-pages/index.ts",
  quiz: "../supabase/functions/generate-quiz/index.ts",
  helper: "../supabase/functions/_shared/rateLimit.ts",
  migration: "../supabase/migrations/20261112100000_edge_function_rate_limits.sql",
  integration: "../supabase/tests/verify_edge_rate_limits.sh",
};
const source = {};
for (const [key, path] of Object.entries(paths)) source[key] = await readFile(new URL(path, import.meta.url), "utf8");

test("all four protected Edge Functions use the shared DB-backed rate limiter", () => {
  for (const key of ["upload", "signed", "processing", "quiz"]) {
    assert.match(source[key], /checkUserRateLimit/);
  }
  assert.match(source.upload, /create_document_upload_url/);
  assert.match(source.signed, /create_document_signed_url/);
  assert.match(source.processing, /process_document_pages_save_pages/);
  assert.match(source.quiz, /generate_quiz/);
});

test("rate-limit responses are explicit 429s with stable codes and retry information", () => {
  assert.match(source.helper, /status: 429/);
  assert.match(source.helper, /RATE_LIMIT_EXCEEDED/);
  assert.match(source.helper, /catch[\s\S]*RATE_LIMIT_SERVICE_UNAVAILABLE/);
  assert.match(source.helper, /retryAfterSeconds/);
  for (const key of ["upload", "signed", "processing", "quiz"]) {
    assert.match(source[key], /rateLimit\.status/);
    assert.match(source[key], /rateLimit\.code/);
  }
});

test("successful quiz replays bypass new-work rate limiting and are not regenerated", () => {
  const replayIndex = source.quiz.indexOf("reservation.r_replay === true");
  const rateIndex = source.quiz.indexOf('checkUserRateLimit(adminClient, userId, "generate_quiz")');
  const providerIndex = source.quiz.indexOf('fetch("https://api.openai.com/v1/responses"');
  assert.ok(replayIndex >= 0 && rateIndex > replayIndex && providerIndex > rateIndex);
  assert.match(source.quiz, /if \(!rateLimit\.allowed\)[\s\S]*?await refund\(adminClient, userId, requestKey, `rate_limit_/);
  assert.match(source.quiz, /"Retry-After": String\(rateLimit\.retryAfterSeconds\)/);
});

test("database counter serializes per-user concurrent requests and fails closed without config", () => {
  assert.match(source.migration, /create table public\.user_edge_rate_limits/);
  assert.match(source.migration, /for update/);
  assert.match(source.migration, /app_config/);
  assert.match(source.migration, /edge_rate_limits/);
  assert.match(source.migration, /RATE_LIMITS_NOT_CONFIGURED/);
  assert.match(source.migration, /RATE_LIMIT_EXCEEDED/);
  assert.match(source.migration, /grant execute .*service_role/s);
});

test("disposable PostgreSQL test covers concurrent cap, save_pages bucket, and timed reset", () => {
  assert.match(source.integration, /3 allowed and 5 denied/);
  assert.match(source.integration, /process_document_pages_save_pages/);
  assert.match(source.integration, /sleep 2/);
  assert.match(source.integration, /RATE_LIMIT_EXCEEDED/);
});
