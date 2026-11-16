export type UploadTokenExpiryDecision =
  | { kind: "ready" }
  | { kind: "wait"; retryAfterSeconds: number }
  | { kind: "invalid" };

export function getUploadTokenExpiryDecision(
  value: unknown,
  nowMs?: number,
  clockSkewMs?: number,
): UploadTokenExpiryDecision;
