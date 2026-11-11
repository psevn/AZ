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
  assert.match(library, /onClick=\{onStartQuiz\}/);
  assert.match(library, /onOpenDocument\(document\.id\)/);
  assert.match(library, /uploaded: "تم الرفع · بانتظار المعالجة"/);
  assert.match(library, /processing: "قيد المعالجة"/);
  assert.match(library, /failed: "تعذّرت المعالجة"/);
  assert.match(library, /scanned: "ملف مصوّر · يحتاج OCR"/);
});

test("workspace mounts the library and refreshes it after upload", () => {
  assert.match(app, /import DocumentLibrary from "\.\/components\/DocumentLibrary"/);
  assert.match(app, /setDocumentsRefresh\(value => value \+ 1\)/);
  assert.match(app, /<DocumentLibrary userId=\{user\.id\}/);
});
