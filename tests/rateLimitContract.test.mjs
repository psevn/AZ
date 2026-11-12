import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [helper, migration, upload, signed, processPages, quiz] = await Promise.all([
  readFile(new URL("../supabase/functions/_shared/rateLimit.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261112090000_user_rate_limits.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/create-document-signed-url/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/generate-quiz/index.ts", import.meta.url), "utf8"),
]);

test("all four Edge Functions use the shared database-backed per-user limiter", () => {
  for (const source of [upload, signed, processPages, quiz]) {
    assert.ok(source.includes('from "../_shared/rateLimit.ts"'));
    assert.ok(source.includes("checkUserRateLimit(adminClient, userId,"));
    assert.ok(source.includes('Retry-After'));
  }
  assert.ok(upload.includes('"create_document_upload_url"'));
  assert.ok(signed.includes('"create_document_signed_url"'));
  assert.ok(processPages.includes('"process_document_pages"'));
  assert.ok(processPages.includes('"process_document_pages_save_pages"'));
  assert.ok(quiz.includes('"generate_quiz"'));
  assert.ok(processPages.indexOf("checkUserRateLimit(adminClient") < processPages.indexOf("const seen = new Set<number>()"));
});

test("save_pages has a distinct stricter rate-limit bucket", () => {
  assert.ok(processPages.includes('action === "save_pages"'));
  assert.ok(processPages.includes('"process_document_pages_save_pages"'));
});

test("rate limit failures return HTTP 429 and configuration failures fail closed", () => {
  assert.ok(helper.includes('status: 429'));
  assert.ok(helper.includes('status: 503'));
  assert.ok(helper.includes("RATE_LIMIT_CONFIGURATION_MISSING"));
  assert.ok(helper.includes("RATE_LIMIT_EXCEEDED"));
  assert.ok(migration.includes("RATE_LIMIT_CONFIGURATION_MISSING"));
  assert.ok(migration.includes("RATE_LIMIT_EXCEEDED"));
});

test("database counter upsert is atomic, per-user, per-endpoint, and service-role-only", () => {
  assert.ok(migration.includes("primary key (user_id, endpoint, window_start)"));
  assert.ok(migration.includes("on conflict (user_id, endpoint, window_start) do update"));
  assert.ok(migration.includes("where existing_counter.request_count < v_max_requests"));
  assert.ok(migration.includes("grant execute on function public.consume_user_rate_limit(uuid, text) to service_role"));
  assert.ok(migration.includes("revoke all on public.user_rate_limit_counters from anon, authenticated"));
});
