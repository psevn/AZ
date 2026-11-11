import test from "node:test";
import assert from "node:assert/strict";
import { makePageBatches, normalizePdfTextItems } from "../src/lib/pdfTextPipeline.mjs";

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
  const batches = makePageBatches("doc-1", pages, 350);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat().map((page) => page.pageNo), [1, 2, 3]);
  for (const batch of batches) {
    const bytes = new TextEncoder().encode(JSON.stringify({
      action: "save_pages",
      documentId: "doc-1",
      pages: batch,
    })).byteLength;
    assert.ok(bytes <= 350);
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
