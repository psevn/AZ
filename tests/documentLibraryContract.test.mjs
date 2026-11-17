import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("document library reads only the signed-in user's documents", () => {
  assert.match(library, /\.from\("documents"\)/);
  assert.match(library, /\.eq\("user_id", userId\)/);
  assert.match(library, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(library, /page_count/);
  assert.match(library, /failed_reason/);
});

test("non-failed documents can be previewed and ready documents offer practice", () => {
  assert.match(library, /document\.status !== "failed"/);
  assert.match(library, /document\.status === "ready" \? t\.open : t\.preview/);
  assert.match(library, /onClick=\{\(\) => onStartQuiz\(document\.id\)\}/);
  assert.match(library, /onOpenDocument\(document\.id\)/);
  assert.match(library, /uploaded: "تم الرفع · بانتظار المعالجة"/);
  assert.match(library, /processing: "قيد المعالجة"/);
  assert.match(library, /failed: "تعذّرت المعالجة"/);
  assert.match(library, /scanned: "ملف مصوّر · يحتاج OCR"/);
});

test("workspace mounts the library and refreshes it after upload", () => {
  assert.match(app, /const DocumentLibrary = lazy\(\(\) => import\("\.\/components\/DocumentLibrary"\)\)/);
  assert.match(app, /<Suspense fallback=\{loadingFallback\}><DocumentLibrary\b/);
  assert.match(app, /onUploaded=\{\(\) => \{ setDocumentsRefresh\(value\s*=>\s*value\s*\+\s*1\); void loadData\(\); \}\}/);
  assert.match(app, /<DocumentLibrary userId=\{user\.id\}/);
});

test("document library offers recovery only for uploaded or stale processing documents", () => {
  assert.match(library, /locked_at/);
  assert.match(library, /Date\.now\(\) - lockTime >= 30 \* 60 \* 1000/);
  assert.match(library, /recoverDocumentProcessing\(document\.id, document\.title/);
  assert.match(library, /document-library-resume/);
});


test("document deletion requires explicit confirmation and invokes the authenticated Edge Function", () => {
  assert.match(library, /setConfirmDeleteId/);
  assert.match(library, /role="group" aria-label=\{t\.confirmDelete\}/);
  assert.match(library, /This permanently removes the PDF|سيُحذف ملف PDF/);
  assert.match(library, /functions\.invoke\("delete-document"/);
  assert.match(library, /body: \{ documentId: document\.id \}/);
  assert.doesNotMatch(library, /body: \{[^}]*userId/);
});

test("document deletion distinguishes completed, pending, and retryable error states", () => {
  assert.match(library, /data\?\.status === "deleted"/);
  assert.match(library, /data\?\.status === "deleting"/);
  assert.match(library, /status: "deleting"/);
  assert.match(library, /retryDelete: "متابعة الحذف"/);
  assert.match(library, /deletionError && <p className="document-upload-error" role="alert">/);
  assert.match(library, /deletionMessage && <p className="document-library-delete-message" role="status"/);
});

test("deleting documents cannot be opened or resumed, but can be retried", () => {
  assert.match(library, /status: "uploaded" \| "processing" \| "ready" \| "failed" \| "deleting"/);
  assert.match(library, /document\.status !== "failed" && document\.status !== "deleting"/);
  assert.match(library, /document\.status === "deleting" \?/);
  assert.match(library, /onClick=\{\(\) => void deleteDocument\(document\)\}/);
});

test("retryable deletion failures refresh the authoritative tombstone state", () => {
  const handler = library.slice(
    library.indexOf("async function deleteDocument"),
    library.indexOf("function statusLabel"),
  );
  const catchBlock = handler.slice(handler.indexOf("} catch (cause) {"));
  assert.ok(catchBlock.indexOf("await load()") >= 0, "deletion failure must refresh the document row");
  assert.ok(
    catchBlock.indexOf("await load()") < catchBlock.indexOf("setDeletionError"),
    "refresh the row before presenting the retryable error",
  );
  assert.match(catchBlock, /setDeletionError/);
});
