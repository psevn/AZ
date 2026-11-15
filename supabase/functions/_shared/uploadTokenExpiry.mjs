/**
 * Decide whether a document's signed-upload token validity window has ended.
 *
 * A null expiry means no upload token was issued (or the reservation was
 * created but signing failed). Missing or malformed values are not equivalent
 * to null: callers must fail closed rather than remove Storage data.
 */
export function getUploadTokenExpiryDecision(
  value,
  nowMs = Date.now(),
  clockSkewMs = 5 * 60 * 1000,
) {
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(clockSkewMs) ||
    clockSkewMs < 0
  ) {
    return { kind: "invalid" };
  }

  if (value === null) return { kind: "ready" };
  if (typeof value !== "string") return { kind: "invalid" };

  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt)) return { kind: "invalid" };

  const cleanupAfter = expiresAt + clockSkewMs;
  if (cleanupAfter > nowMs) {
    return {
      kind: "wait",
      retryAfterSeconds: Math.max(1, Math.ceil((cleanupAfter - nowMs) / 1000)),
    };
  }

  return { kind: "ready" };
}
