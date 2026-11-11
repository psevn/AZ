import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const library = readFileSync(new URL("../src/components/DocumentLibrary.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("document library reads only the signed-in user's documents", () => {
  assert.match(library, /\.from\("documents"\)/);
  assert.match(library, /\.eq\("user_id", userId\)/);
  assert.match(library, /\.order\("created_at", \{ ascending: false \}\)/);
});

test("only ready documents can be opened from the library", () => {
  assert.match(library, /document\.status !== "failed"/);
  assert.match(library, /document\.status === "ready" \? t\.open : t\.preview/);
  assert.match(library, /onStartQuiz\(\)/);
  assert.match(library, /onOpenDocument\(document\.id\)/);
  assert.match(library, /uploaded: "تم الرفع · بانتظار المعالجة"/);
  assert.match(library, /processing: "قيد المعالجة"/);
  assert.match(library, /failed: "تعذّر إكمال الرفع"/);
});

test("workspace mounts the library and refreshes it after upload", () => {
  assert.match(app, /import DocumentLibrary from "\.\/components\/DocumentLibrary"/);
  assert.match(app, /setDocumentsRefresh\(value => value \+ 1\)/);
  assert.match(app, /<DocumentLibrary userId=\{user\.id\}/);
});
