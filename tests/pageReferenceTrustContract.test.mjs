import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const docs = await readFile(new URL("../docs/DOCUMENT_PROCESSING.md", import.meta.url), "utf8");
const quiz = await readFile(new URL("../src/components/QuizPage.tsx", import.meta.url), "utf8");
const reader = await readFile(new URL("../src/components/DocumentReader.tsx", import.meta.url), "utf8");

test("processing documentation states page text and numbering are not independently verified", () => {
  assert.match(docs, /does \*\*not\*\* independently re-open the original PDF bytes/i);
  assert.match(docs, /unverified extraction references/i);
  assert.match(docs, /must label them as unverified/i);
});

test("quiz source-page labels explicitly disclose that original PDF pagination is unverified", () => {
  assert.match(quiz, /Extracted page/);
  assert.match(quiz, /not verified against the original PDF/);
  assert.match(quiz, /غير متحققة من ترقيم ملف PDF الأصلي/);
});

test("document reader explains that extracted page numbers are browser-derived and unverified", () => {
  assert.match(reader, /pageReferenceNotice/);
  assert.match(reader, /browser-side extraction and have not been verified against the original PDF pagination/);
  assert.match(reader, /لم يتم التحقق منها مقابل ترقيم ملف PDF الأصلي/);
});
