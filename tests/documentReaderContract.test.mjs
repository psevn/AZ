import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reader = readFileSync(new URL("../src/components/DocumentReader.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const quizPage = readFileSync(new URL("../src/components/QuizPage.tsx", import.meta.url), "utf8");

test("the reader fetches only the selected page for the owned document", () => {
  assert.match(reader, /\.from\("document_pages"\)/);
  assert.match(reader, /\.select\("page_no,text"\)/);
  assert.match(reader, /\.eq\("document_id", documentId\)/);
  assert.match(reader, /\.eq\("page_no", pageNo\)/);
  assert.match(reader, /\.maybeSingle\(\)/);
  assert.doesNotMatch(reader, /\.insert\(|\.update\(|dangerouslySetInnerHTML/);
});

test("the reader keeps the original PDF beside extracted text and supports page navigation", () => {
  assert.match(reader, /<iframe title=\{title\} src=\{signedUrl\}/);
  assert.match(reader, /pageNo <= 1/);
  assert.match(reader, /pageNo >= totalPages/);
  assert.match(reader, /changePage\(pageNo \+ 1\)/);
  assert.match(reader, /changePage\(pageNo - 1\)/);
});

test("page search highlights text without injecting HTML", () => {
  assert.match(reader, /escapeRegExp/);
  assert.match(reader, /<mark key=\{index\}>\{part\}<\/mark>/);
  assert.match(reader, /type="search"/);
  assert.doesNotMatch(reader, /dangerouslySetInnerHTML/);
});

test("the application opens the custom reader using the verified document metadata", () => {
  assert.match(app, /import DocumentReader from "\.\/components\/DocumentReader"/);
  assert.match(app, /select\("id,title,status,page_count"\)/);
  assert.match(app, /<DocumentReader documentId=\{activeDocument\.id\}/);
  assert.match(app, /pageCount=\{activeDocument\.pageCount\}/);
});

test("practice action preselects the document the student clicked", () => {
  assert.match(app, /onStartQuiz=\{\(documentId\) => \{ setQuizDocumentId\(documentId\); setSection\("quiz"\); \}\}/);
  assert.match(quizPage, /initialDocumentId\?: string \| null/);
  assert.match(quizPage, /document\.id === initialDocumentId/);
});

test("reader explicitly warns that extracted page numbering is unverified against the original PDF", () => {
  assert.match(reader, /Page numbering here comes from browser-side PDF extraction and has not been verified against the original PDF/);
  assert.match(reader, /ترقيم الصفحات هنا ناتج عن استخراج النص داخل المتصفح ولم يتم التحقق منه مقابل ملف PDF الأصلي/);
  assert.match(reader, /document-reader-page-reference-note/);
});
