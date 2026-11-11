import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261111080000_atomic_document_processing.sql", import.meta.url), "utf8");

test("document processing authenticates the user and resolves only their own document", () => {
  assert.match(endpoint, /readBearerToken\(request\)/);
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /\.from\("documents"\)/);
  assert.match(endpoint, /\.eq\("id", documentId\)/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("request bodies and page batches are bounded before persistence", () => {
  assert.match(endpoint, /MAX_BODY_BYTES = 400 \* 1024/);
  assert.match(endpoint, /readLimitedBody\(request\)/);
  assert.match(endpoint, /reader\.cancel\(\)/);
  assert.match(endpoint, /MAX_PAGES_PER_BATCH = 20/);
  assert.match(endpoint, /MAX_PAGE_CHARS = 18_000/);
  assert.match(endpoint, /totalChars > 300_000/);
  assert.match(endpoint, /page\.text\.includes/);
});

test("all state transitions and page persistence are delegated to the atomic database function", () => {
  assert.match(endpoint, /rpc\("process_document_pages_atomic"/);
  assert.match(endpoint, /p_processing_token:/);
  assert.match(endpoint, /p_pages:/);
  assert.match(endpoint, /p_page_count:/);
  assert.match(migration, /for update;/);
  assert.match(migration, /p_processing_token is distinct from v_locked_at/);
  assert.match(migration, /insert into public\.document_pages/);
});

test("a document becomes ready only after every sequential page has been saved", () => {
  assert.match(migration, /v_page_count <> p_page_count or v_min_page <> 1 or v_max_page <> p_page_count/);
  assert.match(migration, /set status = 'ready'/);
  assert.match(migration, /page_count = p_page_count/);
  assert.match(migration, /processed_at = clock_timestamp\(\)/);
});

test("image-only PDFs are not falsely marked ready when no selectable text exists", () => {
  assert.match(migration, /length\(regexp_replace\(coalesce\(v_combined_text, ''\), '\[\[:space:\]\]'/);
  assert.match(migration, /No selectable text was found\. OCR is not available yet\./);
  assert.match(migration, /'statusCode', 422/);
});

test("language metadata is derived from extracted page text", () => {
  assert.match(migration, /regexp_replace\(v_combined_text, '\[\^؀-ۿ\]'/);
  assert.match(migration, /v_language := case/);
  assert.match(migration, /'mixed'/);
});

test("the processing endpoint parses standard Bearer authorization headers", () => {
  const literal = endpoint.match(/\.match\((\/\^Bearer.*?\/i)\)/)?.[1];
  assert.ok(literal, "Bearer token regex should be present");
  const slash = literal.lastIndexOf("/");
  const bearerPattern = new RegExp(literal.slice(1, slash), literal.slice(slash + 1));
  assert.equal("Bearer az-test-token".match(bearerPattern)?.[1], "az-test-token");
});
