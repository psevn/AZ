/** Type declarations for the Qatar timezone helpers implemented in qatarTime.mjs. */
export function qatarDateKey(instant?: Date): string;

export function addCalendarDays(dateKey: string, amount: number): string;

export function qatarWeekday(dateKey: string): number;

export function qatarDateTimeToIso(
  dateKey: string,
  hour?: number,
  minute?: number,
  second?: number,
): string;

export function formatQatarDate(
  dateKey: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string;
