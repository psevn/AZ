import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261112110000_document_deletion_lifecycle.sql", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../supabase/functions/delete-document/index.ts", import.meta.url),
  "utf8",
);
const uploadEndpoint = readFileSync(
  new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url),
  "utf8",
);
const processingEndpoint = readFileSync(
  new URL("../supabase/functions/process-document-pages/index.ts", import.meta.url),
  "utf8",
);
const processingMigration = readFileSync(
  new URL("../supabase/migrations/20261111080000_atomic_document_processing.sql", import.meta.url),
  "utf8",
);
const cors = readFileSync(
  new URL("../supabase/functions/_shared/cors.ts", import.meta.url),
  "utf8",
);

test("document deletion adds a tombstone state and conservatively backfills existing upload-token expiry", () => {
  assert.match(migration, /add column upload_token_expires_at timestamptz/);
  assert.match(migration, /created_at \+ interval '2 hours'/);
  assert.match(migration, /'uploaded', 'processing', 'ready', 'failed', 'deleting'/);
});

test("the begin RPC locks the owner-scoped row and clears the processing lock atomically", () => {
  assert.match(migration, /where d\.id = p_document_id[\s\S]*?and d\.user_id = p_user_id[\s\S]*?for update/);
  assert.match(migration, /set status = 'deleting',[\s\S]*?locked_at = null/);
  assert.match(migration, /storage_path is distinct from/);
  assert.match(migration, /p_user_id::text \|\| '\/' \|\| p_document_id::text \|\| '\.pdf'/);
});

test("completion refuses to delete the relational tombstone while a signed upload token may still work", () => {
  assert.match(migration, /upload_token_expires_at \+ interval '5 minutes' > clock_timestamp\(\)/);
  assert.match(migration, /UPLOAD_TOKEN_WINDOW_ACTIVE/);
  assert.match(migration, /delete from public\.documents/);
  assert.match(migration, /status = 'deleting'/);
  assert.match(migration, /grant execute on function public\.begin_document_deletion[\s\S]*to service_role/);
  assert.match(migration, /grant execute on function public\.complete_document_deletion[\s\S]*to service_role/);
});

test("the deletion endpoint authenticates the caller and derives ownership from Auth, never request fields", () => {
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /p_user_id: userId/);
  assert.match(endpoint, /rpc\("begin_document_deletion"/);
  assert.doesNotMatch(endpoint, /body\.(userId|storagePath|bucket)/);
  assert.doesNotMatch(endpoint, /auth\.admin\.deleteUser/);
  assert.match(endpoint, /checkUserRateLimit\(adminClient, userId, "process_document_pages"\)/);
});

test("deletion waits through signed-upload expiry and uses Storage API plus independent absence verification", () => {
  assert.match(endpoint, /UPLOAD_CLOCK_SKEW_MS = 5 \* 60 \* 1000/);
  assert.match(endpoint, /status: "deleting"/);
  assert.match(endpoint, /bucket\.remove\(\[storagePath\]\)/);
  assert.match(endpoint, /bucket\.list\(userId/);
  assert.match(endpoint, /item\.name === `\$\{documentId\}\.pdf`/);
  assert.match(endpoint, /if \(listError\)/);
  assert.match(endpoint, /if \(objectStillExists\)/);
  assert.ok(
    endpoint.indexOf("bucket.remove([storagePath])") < endpoint.indexOf("bucket.list(userId") &&
    endpoint.indexOf("bucket.list(userId") < endpoint.indexOf('rpc("complete_document_deletion"'),
    "the row must only be finalized after Storage absence is verified",
  );
  assert.doesNotMatch(endpoint, /from\("storage\.objects"\)/);
});

test("upload creation persists token expiry conditionally before exposing the signed token", () => {
  assert.match(uploadEndpoint, /createSignedUploadUrl\(storagePath/);
  assert.match(uploadEndpoint, /rpc\("record_document_upload_token_expiry"/);
  assert.match(migration, /greatest\([\s\S]*p_expires_at/);
  assert.ok(
    uploadEndpoint.indexOf('rpc("record_document_upload_token_expiry"') <
      uploadEndpoint.indexOf("return json(200, { documentId, path: signed.path, token: signed.token })"),
    "signed token must not be returned before its expiry is persisted",
  );
});

test("processing and deletion serialize on the same document row lock", () => {
  assert.match(processingMigration, /where d\.id = p_document_id and d\.user_id = p_user_id[\s\S]*?for update/);
  assert.match(processingEndpoint, /rpc\("process_document_pages_atomic"/);
  assert.match(migration, /for update/);
});

test("the endpoint uses the shared fail-closed CORS policy and bounded POST body", () => {
  assert.match(endpoint, /corsForRequest\(request\)/);
  assert.match(cors, /CORS_NOT_CONFIGURED/);
  assert.match(endpoint, /request\.method !== "POST"/);
  assert.match(endpoint, /MAX_BODY_BYTES = 2048/);
  assert.match(endpoint, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength/);
});
