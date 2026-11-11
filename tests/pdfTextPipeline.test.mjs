import test from "node:test";
import assert from "node:assert/strict";
import { makePageBatches, normalizePdfTextItems } from "../src/lib/pdfTextPipeline.mjs";
import { readFileSync } from "node:fs";

const extractor = readFileSync(new URL("../src/lib/extractPdfText.ts", import.meta.url), "utf8");
const uploadPanel = readFileSync(new URL("../src/components/DocumentUpload.tsx", import.meta.url), "utf8");

test("PDF text normalization preserves paragraph boundaries and removes excess whitespace", () => {
  const text = normalizePdfTextItems([
    { str: "AZ", hasEOL: false },
    { str: " Intelligence", hasEOL: true },
    { str: "Academic", hasEOL: true },
    { str: "Universe", hasEOL: true },
  ]);
  assert.equal(text, "AZ Intelligence\nAcademic\nUniverse");
});

test("PDF text normalization ignores non-text items and empty fragments", () => {
  const text = normalizePdfTextItems([
    { str: "", hasEOL: false },
    { str: "Page", hasEOL: false },
    { hasEOL: false },
    { str: "  one  ", hasEOL: true },
  ]);
  assert.equal(text, "Page one");
});

test("page batches preserve order and split before the UTF-8 payload limit", () => {
  const pages = [
    { pageNo: 1, text: "أ".repeat(100) },
    { pageNo: 2, text: "ب".repeat(100) },
    { pageNo: 3, text: "ج".repeat(100) },
  ];
  const batches = makePageBatches("doc-1", pages, 500);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat().map((page) => page.pageNo), [1, 2, 3]);
  for (const batch of batches) {
    const bytes = new TextEncoder().encode(JSON.stringify({
      action: "save_pages",
      documentId: "doc-1",
      pages: batch,
    })).byteLength;
    assert.ok(bytes <= 500);
  }
});

test("page batching rejects oversized page text instead of silently truncating it", () => {
  assert.throws(
    () => makePageBatches("doc-1", [{ pageNo: 1, text: "x".repeat(18_001) }]),
    /too much text/,
  );
});

test("page batching rejects invalid page numbers and text values", () => {
  assert.throws(() => makePageBatches("doc-1", [{ pageNo: 0, text: "x" }]), /Invalid extracted PDF page/);
  assert.throws(() => makePageBatches("doc-1", [{ pageNo: 1, text: 123 }]), /Invalid extracted PDF page/);
});

test("PDF.js extracts selectable text locally with a version-matched worker", () => {
  assert.match(extractor, /from "pdfjs-dist"/);
  assert.match(extractor, /pdfjs-dist\/build\/pdf\.worker\.mjs\?url/);
  assert.match(extractor, /GlobalWorkerOptions\.workerSrc = workerUrl/);
  assert.match(extractor, /pdfjsLib\.getDocument/);
  assert.match(extractor, /page\.getTextContent\(\)/);
  assert.match(extractor, /page\.cleanup\(\)/);
  assert.match(extractor, /loadingTask\.destroy\(\)/);
  assert.doesNotMatch(extractor, /isEvalSupported/);
  assert.match(extractor, /pdf\.numPages > 1_000/);
  assert.doesNotMatch(extractor, /fetch\(/);
});

test("the upload flow extracts locally, persists bounded batches, then completes processing", () => {
  assert.match(uploadPanel, /import\("\.\.\/lib\/extractPdfText"\)/);
  assert.match(uploadPanel, /import\("\.\.\/lib\/pdfTextPipeline\.mjs"\)/);
  assert.match(uploadPanel, /action: "save_pages"/);
  assert.match(uploadPanel, /action: "complete"/);
  assert.match(uploadPanel, /process-document-pages/);
});
