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

  // PostgREST serializes PostgreSQL timestamptz values as ISO timestamps.
  // Date.parse alone normalizes impossible calendar dates (for example,
  // February 30) and 24:00 into a different instant. Reject those values
  // before parsing so a malformed expiry can never authorize Storage cleanup.
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match) return { kind: "invalid" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31, isLeapYear ? 29 : 28, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31,
  ];

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return { kind: "invalid" };
  }

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
