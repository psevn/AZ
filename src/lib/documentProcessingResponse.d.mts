export type DocumentProcessingError = Error & {
  code?: string;
  status?: number;
};

export function createDocumentProcessingError(
  payload: unknown,
  status?: number,
): DocumentProcessingError;

export function normalizeDocumentProcessingError(
  cause: unknown,
): Promise<DocumentProcessingError>;

export function isTerminalDocumentProcessingError(cause: unknown): boolean;
