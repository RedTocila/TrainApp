import type { FullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";

type CachedSlice = Omit<FullCalendarMonthSlice, never>;

/** Survives dialog close/reopen within the same session. */
const monthSliceCache = new Map<string, CachedSlice>();

export function getCachedFullCalendarMonth(cacheKey: string): CachedSlice | null {
  return monthSliceCache.get(cacheKey) ?? null;
}

export function setCachedFullCalendarMonth(
  cacheKey: string,
  slice: CachedSlice
): void {
  monthSliceCache.set(cacheKey, slice);
}

export function hasCachedFullCalendarMonth(cacheKey: string): boolean {
  return monthSliceCache.has(cacheKey);
}

export function listCachedFullCalendarMonths(): CachedSlice[] {
  return [...monthSliceCache.values()];
}
