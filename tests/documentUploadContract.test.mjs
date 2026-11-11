import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/DocumentUpload.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8");

test("Academic workspace renders the authenticated PDF upload panel", () => {
  assert.match(app, /<DocumentUpload userId=\{user\.id\} lang=\{lang\}/);
  assert.match(panel, /accept="application\/pdf,\.pdf"/);
  assert.match(panel, /MAX_FILE_BYTES = 20 \* 1024 \* 1024/);
});

test("browser creates an owner-scoped document row and uploads only with a signed token", () => {
  assert.match(panel, /user_id: userId/);
  assert.match(panel, /storage_path: storagePath/);
  assert.match(panel, /functions\.invoke\(\s*"create-document-upload-url"/);
  assert.match(panel, /uploadToSignedUrl\(signed\.path, signed\.token, file/);
  assert.doesNotMatch(panel, /\.upload\(storagePath/);
});

test("upload URL endpoint authenticates the owner and accepts only their pending upload row", () => {
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /Bearer\\s\+/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /\.eq\("status", "uploaded"\)/);
  assert.match(endpoint, /document\.storage_path !== `\$\{userId\}\/\$\{documentId\}\.pdf`/);
  assert.match(endpoint, /createSignedUploadUrl\(document\.storage_path/);
  assert.doesNotMatch(endpoint, /body\.storagePath|body\.path|body\.bucket/);
});

test("upload URL endpoint rejects malformed JSON and does not expose privileged credentials", () => {
  assert.match(endpoint, /Array\.isArray\(parsed\)/);
  assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(endpoint, /Cache-Control": "no-store"/);
  assert.doesNotMatch(panel, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});
