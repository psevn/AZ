import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/DocumentUpload.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8");

test("Academic workspace renders the authenticated PDF upload panel", () => {
  assert.match(app, /<DocumentUpload lang=\{lang\} onUploaded=\{\(\) => void loadData\(\)\} \/>/);
  assert.match(panel, /accept="application\/pdf,\.pdf"/);
  assert.match(panel, /MAX_FILE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(panel, /!file\.name\.toLowerCase\(\)\.endsWith\("\\.pdf"\) \|\| \(file\.type !== "" && file\.type !== "application\/pdf"\)/);
});

test("browser delegates document creation and failure status to the trusted endpoint", () => {
  assert.match(panel, /functions\.invoke\(\s*"create-document-upload-url"/);
  assert.match(panel, /title: file\.name/);
  assert.match(panel, /action: "mark_failed"/);
  assert.match(panel, /uploadToSignedUrl\(signed\.path, signed\.token, file/);
  assert.doesNotMatch(panel, /\.from\(["']documents["']\)\.insert/);
  assert.doesNotMatch(panel, /\.from\(["']documents["']\)\.update/);
  assert.doesNotMatch(panel, /\.upload\(storagePath/);
});

test("upload URL endpoint authenticates and creates an owner-scoped record server-side", () => {
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /Bearer\\s\+/);
  assert.match(endpoint, /user_id: userId/);
  assert.match(endpoint, /storage_path: storagePath/);
  assert.match(endpoint, /\.insert\(\{/);
  assert.match(endpoint, /status: "uploaded"/);
  assert.match(endpoint, /createSignedUploadUrl\(storagePath/);
  assert.doesNotMatch(endpoint, /body\.storagePath|body\.path|body\.bucket/);
});

test("upload endpoint scopes failure updates to the authenticated owner", () => {
  assert.match(endpoint, /action === "mark_failed"/);
  assert.match(endpoint, /\.eq\("user_id", userId\)/);
  assert.match(endpoint, /\.eq\("status", "uploaded"\)/);
  assert.match(endpoint, /status: "failed", failed_reason:/);
});

test("upload URL endpoint rejects malformed JSON and keeps privileged credentials server-side", () => {
  assert.match(endpoint, /Array\.isArray\(parsed\)/);
  assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(endpoint, /Cache-Control": "no-store"/);
  assert.doesNotMatch(panel, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});
