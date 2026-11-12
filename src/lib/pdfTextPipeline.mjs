export function normalizePdfTextItems(items) {
  let output = "";
  for (const item of items) {
    if (typeof item.str !== "string" || item.str.length === 0) continue;
    output += item.str;
    output += item.hasEOL ? "\n" : " ";
  }
  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const MAX_PAGES_PER_BATCH = 20;

export function makePageBatches(documentId, pages, maxBytes = 300 * 1024) {
  const encoder = new TextEncoder();
  const batches = [];
  let current = [];

  for (const page of pages) {
    if (!Number.isInteger(page.pageNo) || page.pageNo < 1 || typeof page.text !== "string") {
      throw new TypeError("Invalid extracted PDF page.");
    }
    if (page.text.length > 18_000) {
      throw new RangeError("Page " + page.pageNo + " contains too much text for one processing batch.");
    }

    const candidate = [...current, page];
    const exceedsPageLimit = candidate.length > MAX_PAGES_PER_BATCH;
    const payload = JSON.stringify({ action: "save_pages", documentId, pages: candidate });
    if (exceedsPageLimit || encoder.encode(payload).byteLength > maxBytes) {
      if (current.length === 0) {
        throw new RangeError("Page " + page.pageNo + " is too large to save safely.");
      }
      batches.push(current);
      current = [page];
      const singlePayload = JSON.stringify({ action: "save_pages", documentId, pages: current });
      if (encoder.encode(singlePayload).byteLength > maxBytes) {
        throw new RangeError("Page " + page.pageNo + " is too large to save safely.");
      }
    } else {
      current = candidate;
    }
  }

  if (current.length) batches.push(current);
  return batches;
}
