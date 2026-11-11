export type ExtractedPdfPage = { pageNo: number; text: string };

export function normalizePdfTextItems(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let output = "";
  for (const item of items) {
    if (typeof item.str !== "string" || item.str.length === 0) continue;
    output += item.str;
    output += item.hasEOL ? "\n" : " ";
  }
  return output
    .replace(/[ \\t]+\\n/g, "\n")
    .replace(/\\n{3,}/g, "\n\n")
    .replace(/[ \\t]{2,}/g, " ")
    .trim();
}

export function makePageBatches(
  documentId: string,
  pages: ExtractedPdfPage[],
  maxBytes = 300 * 1024,
): ExtractedPdfPage[][] {
  const encoder = new TextEncoder();
  const batches: ExtractedPdfPage[][] = [];
  let current: ExtractedPdfPage[] = [];

  for (const page of pages) {
    if (!Number.isInteger(page.pageNo) || page.pageNo < 1 || typeof page.text !== "string") {
      throw new TypeError("Invalid extracted PDF page.");
    }
    if (page.text.length > 18_000) {
      throw new RangeError(`Page ${page.pageNo} contains too much text for one processing batch.`);
    }

    const candidate = [...current, page];
    const payload = JSON.stringify({ action: "save_pages", documentId, pages: candidate });
    if (encoder.encode(payload).byteLength > maxBytes) {
      if (current.length === 0) {
        throw new RangeError(`Page ${page.pageNo} is too large to save safely.`);
      }
      batches.push(current);
      current = [page];
      const singlePayload = JSON.stringify({ action: "save_pages", documentId, pages: current });
      if (encoder.encode(singlePayload).byteLength > maxBytes) {
        throw new RangeError(`Page ${page.pageNo} is too large to save safely.`);
      }
    } else {
      current = candidate;
    }
  }

  if (current.length) batches.push(current);
  return batches;
}
