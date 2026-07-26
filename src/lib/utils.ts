import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Wall-clock date key for a JS timezone offset (Date#getTimezoneOffset()). */
export function getDateKeyForTimezoneOffset(
  timezoneOffsetMinutes: number,
  at: Date = new Date()
): string {
  const localMs = at.getTime() - timezoneOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Date whose local getters match the user's wall clock (for server actions). */
export function getWallClockDate(
  timezoneOffsetMinutes: number,
  at: Date = new Date()
): Date {
  const localMs = at.getTime() - timezoneOffsetMinutes * 60_000;
  const local = new Date(localMs);
  return new Date(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds()
  );
}

/**
 * Half-open UTC ISO bounds [start, end) for a calendar `yyyy-MM-dd` in the
 * viewer's timezone (`Date#getTimezoneOffset()` minutes).
 */
export function localDateKeyRangeUtc(
  dateKey: string,
  timezoneOffsetMinutes = 0
): { startIso: string; endIso: string } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startMs =
    Date.UTC(year, month - 1, day) + timezoneOffsetMinutes * 60_000;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

/** Calendar date key for an instant in the viewer's timezone. */
export function formatDateKeyInTimezone(
  instant: Date | string,
  timezoneOffsetMinutes = 0
): string {
  const at = typeof instant === "string" ? new Date(instant) : instant;
  return getDateKeyForTimezoneOffset(timezoneOffsetMinutes, at);
}
