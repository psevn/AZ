function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDocumentProcessingError(payload, status) {
  const details = isRecord(payload) ? payload : {};
  const message = typeof details.error === "string" && details.error.trim()
    ? details.error
    : "Document processing did not complete.";
  const error = new Error(message);
  if (typeof details.code === "string") error.code = details.code;
  const resolvedStatus = Number.isInteger(status)
    ? status
    : Number.isInteger(details.statusCode) ? details.statusCode : undefined;
  if (resolvedStatus !== undefined) error.status = resolvedStatus;
  return error;
}

export async function normalizeDocumentProcessingError(cause) {
  if (!isRecord(cause) || !isRecord(cause.context) || typeof cause.context.clone !== "function") {
    return cause instanceof Error ? cause : createDocumentProcessingError(null);
  }
  try {
    const payload = await cause.context.clone().json();
    if (!isRecord(payload)) return cause instanceof Error ? cause : createDocumentProcessingError(null);
    return createDocumentProcessingError(payload, cause.context.status);
  } catch {
    return cause instanceof Error ? cause : createDocumentProcessingError(null);
  }
}

export function isTerminalDocumentProcessingError(cause) {
  return isRecord(cause) && cause.status === 422 && cause.code === "no_text";
}
