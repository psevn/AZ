import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDocumentProcessingError, isTerminalDocumentProcessingError, normalizeDocumentProcessingError } from "../src/lib/documentProcessingResponse.mjs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/DocumentUpload.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../supabase/functions/create-document-upload-url/index.ts", import.meta.url), "utf8");
const corsHelper = readFileSync(new URL("../supabase/functions/_shared/cors.ts", import.meta.url), "utf8");
const processingMigration = readFileSync(new URL("../supabase/migrations/20261111080000_atomic_document_processing.sql", import.meta.url), "utf8");

test("Academic workspace renders the authenticated PDF upload panel", () => {
  assert.match(app, /<DocumentUpload lang=\{lang\} onUploaded=\{\(\) => \{/);
  assert.match(panel, /accept="application\/pdf,\.pdf"/);
  assert.match(panel, /MAX_FILE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(panel, /!file\.name\.toLowerCase\(\)\.endsWith\("\.pdf"\) \|\| \(file\.type !== "" && file\.type !== "application\/pdf"\)/);
});

test("browser delegates document creation and failure status to the trusted endpoint", () => {
  assert.match(panel, /functions\.invoke\(\s*"create-document-upload-url"/);
  assert.match(panel, /title: file\.name/);
  assert.match(panel, /action: "mark_failed"/);
  assert.match(panel, /process-document-pages/);
  assert.match(panel, /action: "start"/);
  assert.match(panel, /action: "save_pages"/);
  assert.match(panel, /action: "complete"/);
  assert.match(panel, /extractPdfPages/);
  assert.doesNotMatch(panel, /document_pages/);
  assert.match(panel, /uploadToSignedUrl\(signed\.path, signed\.token, file/);
  assert.doesNotMatch(panel, /\.from\(["']documents["']\)\.insert/);
  assert.doesNotMatch(panel, /\.from\(["']documents["']\)\.update/);
  assert.doesNotMatch(panel, /\.upload\(storagePath/);
});

test("upload URL endpoint authenticates and creates an owner-scoped record server-side", () => {
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /Bearer\\s\+/);
  assert.match(endpoint, /rpc\("create_document_upload_record"/);
  assert.match(endpoint, /p_user_id: userId/);
  assert.match(endpoint, /p_storage_path: storagePath/);
  assert.doesNotMatch(endpoint, /adminClient\.from\("documents"\)\.insert/);
  assert.match(endpoint, /ACTIVE_DOCUMENT_LIMIT_EXCEEDED/);
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
  assert.match(corsHelper, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(panel, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});


test("structured processing errors preserve the server message, code, and HTTP status", async () => {
  const response = new Response(JSON.stringify({
    error: "No selectable text was found. OCR is not available yet.",
    code: "no_text",
  }), { status: 422, headers: { "content-type": "application/json" } });
  const normalized = await normalizeDocumentProcessingError(Object.assign(
    new Error("Edge Function returned a non-2xx status code"),
    { context: response },
  ));
  assert.equal(normalized.message, "No selectable text was found. OCR is not available yet.");
  assert.equal(normalized.code, "no_text");
  assert.equal(normalized.status, 422);
  assert.equal(isTerminalDocumentProcessingError(normalized), true);
  assert.equal(await response.clone().text().then(Boolean), true);
});

test("only the known terminal no-text response skips a redundant failure transition", () => {
  assert.equal(isTerminalDocumentProcessingError(createDocumentProcessingError({ error: "no text", code: "no_text" }, 422)), true);
  assert.equal(isTerminalDocumentProcessingError(createDocumentProcessingError({ error: "busy", code: "PROCESSING_BUSY" }, 409)), false);
  assert.equal(isTerminalDocumentProcessingError(createDocumentProcessingError({ error: "server", code: "internal" }, 500)), false);
});

test("non-JSON Edge Function errors preserve the original error", async () => {
  const original = Object.assign(new Error("request failed"), {
    context: new Response("not-json", { status: 500 }),
  });
  const normalized = await normalizeDocumentProcessingError(original);
  assert.equal(normalized, original);
});

test("processing payloads without a server message use a safe fallback", () => {
  assert.equal(createDocumentProcessingError(null).message, "Document processing did not complete.");
});

test("upload and recovery surfaces use the shared terminal-error contract", () => {
  const recovery = readFileSync(new URL("../src/lib/recoverDocumentProcessing.ts", import.meta.url), "utf8");
  const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");
  assert.match(panel, /normalizeDocumentProcessingError/);
  assert.match(panel, /processingStarted && !terminalNoTextFailure/);
  assert.match(panel, /OCR is not available yet/);
  assert.match(recovery, /normalizeDocumentProcessingError/);
  assert.match(recovery, /processingStarted && !isTerminalDocumentProcessingError\(cause\)/);
  assert.match(library, /isTerminalDocumentProcessingError/);
  assert.match(library, /ملف PDF مصوّر ويحتاج إلى OCR/);
});


test("the no-text response is terminal and releases the processing lock", () => {
  const noTextBranch = processingMigration.slice(
    processingMigration.indexOf("if length(regexp_replace"),
    processingMigration.indexOf("v_arabic_count :="),
  );
  assert.ok(noTextBranch.length > 0, "no-text terminal branch exists");
  assert.match(noTextBranch, /status = 'failed'/);
  assert.match(noTextBranch, /locked_at = null/);
  assert.match(noTextBranch, /statusCode', 422/);
  assert.match(noTextBranch, /code', 'no_text'/);
});
