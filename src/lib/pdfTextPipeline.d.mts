export type ExtractedPdfPage = { pageNo: number; text: string };
export function normalizePdfTextItems(items: Array<{ str?: string; hasEOL?: boolean }>): string;
export function makePageBatches(documentId: string, pages: ExtractedPdfPage[], maxBytes?: number): ExtractedPdfPage[][];
