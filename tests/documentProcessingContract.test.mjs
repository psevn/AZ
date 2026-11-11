import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(
  new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url),
  "utf8",
);

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
});

test("page writes are server-managed, owner-scoped, and idempotent by document page", () => {
  assert.match(endpoint, /action === "save_pages"/);
  assert.match(endpoint, /document_id: documentId, user_id: userId, page_no: pageNo, text: page\.text/);
  assert.match(endpoint, /\.from\("document_pages"\)/);
  assert.match(endpoint, /\.upsert\(rows, \{ onConflict: "document_id,page_no" \}\)/);
  assert.match(endpoint, /page\.text\.includes\("\\u0000"\)/);
});

test("a document becomes ready only after every sequential page has been saved", () => {
  assert.match(endpoint, /action === "complete"/);
  assert.match(endpoint, /pages\.length !== pageCount/);
  assert.match(endpoint, /Number\(page\.page_no\) !== index \+ 1/);
  assert.match(endpoint, /status: "ready"/);
  assert.match(endpoint, /page_count: pageCount/);
  assert.match(endpoint, /processed_at: new Date\(\)\.toISOString\(\)/);
});

test("image-only PDFs are not falsely marked ready when no selectable text exists", () => {
  assert.match(endpoint, /combinedText\.trim\(\)\.length === 0/);
  assert.match(endpoint, /No selectable text was found\. OCR is not available yet\./);
  assert.match(endpoint, /status: "failed"/);
});

test("language metadata is derived from extracted page text", () => {
  assert.match(endpoint, /detectLanguage\(combinedText\)/);
  assert.match(endpoint, /"ar" \| "en" \| "mixed"/);
});
