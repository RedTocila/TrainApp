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
