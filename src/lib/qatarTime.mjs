const TIME_ZONE = "Asia/Qatar";
const NUMBERING_SYSTEM = "latn";
const pad = value => String(value).padStart(2, "0");

/** Returns the Qatar calendar date for an instant, independent of the host machine's timezone. */
export function qatarDateKey(instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

/** Adds calendar days to a YYYY-MM-DD key using UTC arithmetic (not the host timezone). */
export function addCalendarDays(dateKey, amount) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}

/** Sunday = 0 ... Saturday = 6 for a YYYY-MM-DD calendar date. */
export function qatarWeekday(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Converts a Qatar wall-clock date/time to the UTC instant stored in timestamptz. Qatar is UTC+3, no DST. */
export function qatarDateTimeToIso(dateKey, hour = 23, minute = 59, second = 0) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second)).toISOString();
}

/** Formats a Qatar calendar date without allowing the host timezone to shift the day. */
export function formatQatarDate(dateKey, locale = "en-GB", options = {}) {
  const instant = new Date(qatarDateTimeToIso(dateKey, 12, 0));
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    numberingSystem: NUMBERING_SYSTEM,
    ...options,
  }).format(instant);
}
