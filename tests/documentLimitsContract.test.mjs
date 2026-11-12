import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const upload = await readFile(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8");
const processing = await readFile(new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261112090000_document_upload_limits.sql", import.meta.url), "utf8");
const integration = await readFile(new URL("../supabase/tests/verify_document_upload_limits.sh", import.meta.url), "utf8");

test("document creation is delegated to a server-side transactional quota RPC", () => {
  assert.match(upload, /rpc\("create_document_upload_record"/);
  assert.doesNotMatch(upload, /adminClient\.from\("documents"\)\.insert/);
  assert.match(migration, /create function public\.create_document_upload_record/);
  assert.match(migration, /for update/);
  assert.match(migration, /insert into public\.documents/);
});

test("document and active-upload limits are owner-configured and stale uploads expire", () => {
  assert.match(migration, /app_config/);
  assert.match(migration, /document_limits/);
  assert.match(migration, /max_documents/);
  assert.match(migration, /max_active_uploads/);
  assert.match(migration, /status = 'uploaded'/);
  assert.match(migration, /make_interval\(mins => v_stale_uploaded_minutes\)/);
  assert.match(migration, /ACTIVE_DOCUMENT_LIMIT_EXCEEDED/);
  assert.match(migration, /DOCUMENT_LIMIT_EXCEEDED/);
});

test("page and extracted-text quotas are enforced in a serialized database trigger", () => {
  assert.match(migration, /create function private\.enforce_document_page_limits/);
  assert.match(migration, /for update/);
  assert.match(migration, /create trigger document_pages_enforce_user_limits/);
  assert.match(migration, /DOCUMENT_PAGE_LIMIT_EXCEEDED/);
  assert.match(migration, /DOCUMENT_TEXT_LIMIT_EXCEEDED/);
  assert.match(processing, /DOCUMENT_PAGE_LIMIT_EXCEEDED/);
  assert.match(processing, /DOCUMENT_TEXT_LIMIT_EXCEEDED/);
});

test("disposable PostgreSQL checks cover active caps, stale expiry, page/text caps and upserts", () => {
  assert.match(integration, /ACTIVE_DOCUMENT_LIMIT_EXCEEDED/);
  assert.match(integration, /stale uploaded row/i);
  assert.match(integration, /DOCUMENT_PAGE_LIMIT_EXCEEDED/);
  assert.match(integration, /DOCUMENT_TEXT_LIMIT_EXCEEDED/);
  assert.match(integration, /on conflict\(document_id,page_no\)/);
});
