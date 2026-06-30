// Timezone-aware date boundary helpers (no external date library required).

function getOffsetMs(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year");
  const mo = get("month") - 1;
  const d = get("day");
  const h = get("hour") % 24; // "24" edge case at midnight
  const mi = get("minute");
  const s = get("second");

  return Date.UTC(y, mo, d, h, mi, s) - date.getTime();
}

/** Returns UTC start and end of the calendar day for `date` in `timezone`. */
export function dayBoundsInTz(
  timezone: string,
  date: Date
): { start: Date; end: Date } {
  const offsetMs = getOffsetMs(timezone, date);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year");
  const mo = get("month") - 1;
  const d = get("day");

  const start = new Date(Date.UTC(y, mo, d) - offsetMs);
  const end = new Date(start.getTime() + 86_400_000 - 1);
  return { start, end };
}

/** Returns UTC start and end of the calendar month for `date` in `timezone`. */
export function monthBoundsInTz(
  timezone: string,
  date: Date
): { start: Date; end: Date } {
  const offsetMs = getOffsetMs(timezone, date);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year");
  const mo = get("month") - 1;
  const lastDay = new Date(y, mo + 1, 0).getDate();

  const start = new Date(Date.UTC(y, mo, 1) - offsetMs);
  const end = new Date(Date.UTC(y, mo, lastDay, 23, 59, 59, 999) - offsetMs);
  return { start, end };
}
