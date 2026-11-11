import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { normalizePdfTextItems, type ExtractedPdfPage } from "./pdfTextPipeline.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfExtractionProgress = (pageNo: number, pageCount: number) => void;

export async function extractPdfPages(
  file: File,
  onProgress?: PdfExtractionProgress,
): Promise<{ pages: ExtractedPdfPage[]; pageCount: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  try {
    const pdf = await loadingTask.promise;
    if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1 || pdf.numPages > 1_000) {
      throw new RangeError("This PDF must contain between 1 and 1,000 pages.");
    }

    const pages: ExtractedPdfPage[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      try {
        const content = await page.getTextContent();
        const textItems = content.items.flatMap((item) => {
          if (!("str" in item)) return [];
          return [{ str: item.str, hasEOL: item.hasEOL }];
        });
        const text = normalizePdfTextItems(textItems);
        if (text.length > 18_000) {
          throw new RangeError("Page " + pageNo + " contains too much text to process safely.");
        }
        pages.push({ pageNo, text });
      } finally {
        page.cleanup();
      }
      onProgress?.(pageNo, pdf.numPages);
    }

    return { pages, pageCount: pdf.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
