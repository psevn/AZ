import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const upload = readFileSync(new URL("../src/components/DocumentUpload.tsx", import.meta.url), "utf8");
const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("Study Pack opens with a compact heading and the upload action first", () => {
  assert.match(app, /study-pack-heading/);
  assert.match(app, /study-placeholder content-panel study-pack-view/);
  assert.doesNotMatch(app, /Knowledge system \/ 01/);
  assert.doesNotMatch(app, /study-orbit/);
  assert.ok(app.indexOf("<DocumentUpload") < app.indexOf("<DocumentLibrary"));
});

test("PDF upload supports accessible file picking and drag and drop", () => {
  assert.match(upload, /accept="application\/pdf,\.pdf"/);
  assert.match(upload, /aria-label=\{ar \? "اختر ملف PDF" : "Choose a PDF file"\}/);
  assert.match(upload, /onDragOver=/);
  assert.match(upload, /onDragLeave=/);
  assert.match(upload, /onDrop=/);
  assert.match(upload, /MAX_FILE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(upload, /PDF · حتى 20 ميجابايت/);
  assert.match(upload, /PDF · Up to 20 MB/);
  assert.doesNotMatch(upload, /↗/);
});

test("upload guidance describes only the implemented extraction and practice flow", () => {
  assert.match(upload, /document-upload-steps/);
  assert.match(upload, /استخراج النص من صفحات المستند/);
  assert.match(upload, /Text is extracted from document pages/);
  assert.match(upload, /ابدأ التدريب/);
  assert.match(upload, /Start practising/);
  assert.doesNotMatch(upload, /Audio Overview|Video Overview|ملخص صوتي|ملخص تلقائي/);
});

test("placeholder Knowledge Space is not exposed as a live Study navigation item", () => {
  assert.match(app, /const workspaceNav:Page\[\] = \["workspace","focus"\]/);
  assert.doesNotMatch(app, /const workspaceNav:Page\[\] = \["workspace","notebook","focus"\]/);
});

test("account navigation uses an avatar without exposing the email address", () => {
  const accountButton = app.match(/<button className="rail-account"[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.ok(accountButton, "profile navigation button exists");
  assert.match(accountButton, /aria-label=\{ar\?"الملف الشخصي":"Profile"\}/);
  assert.match(accountButton, /avatarUrl/);
  assert.doesNotMatch(accountButton, /user\.email/);
  assert.match(app, /user\?\.user_metadata\?\.avatar_url/);
});

test("document library retains real statuses and only offers practice for ready documents", () => {
  assert.match(library, /document\.status === "ready" \? t\.open : t\.preview/);
  assert.match(library, /document\.status === "ready"/);
  assert.match(library, /uploaded: "تم الرفع · بانتظار المعالجة"/);
  assert.match(library, /processing: "قيد المعالجة"/);
  assert.match(library, /failed: "تعذّرت المعالجة"/);
  assert.match(library, /onClick=\{\(\) => onStartQuiz\(document\.id\)\}/);
});

test("Study Pack upload controls keep readable type and visible keyboard focus", () => {
  assert.match(styles, /\.document-upload-dropzone input \{\s*pointer-events: auto/);
  assert.match(styles, /\.document-upload-dropzone:focus-within/);
  assert.match(styles, /\.document-upload-submit:focus-visible/);
  assert.match(styles, /\.document-upload-submit\.az-btn--primary:disabled/);
  assert.match(styles, /font-size: 12px/);
});
