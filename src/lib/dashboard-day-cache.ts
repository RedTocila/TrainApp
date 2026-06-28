const cache = new Map<string, { data: unknown; fetchedAt: number }>();

export const DASHBOARD_DAY_CACHE_TTL_MS = 5 * 60_000;

export function dashboardDayCacheKey(
  clientId: string,
  namespace: string,
  dateKey: string
): string {
  return `${clientId}:${namespace}:${dateKey}`;
}

export function getDashboardDayCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  return entry.data as T;
}

export function setDashboardDayCache<T>(key: string, data: T): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

export function isDashboardDayCacheFresh(
  key: string,
  maxAgeMs = DASHBOARD_DAY_CACHE_TTL_MS
): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt <= maxAgeMs;
}

export function clearDashboardDayCache(namespace?: string, clientId?: string): void {
  if (!namespace && !clientId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (namespace && clientId) {
      if (key.startsWith(`${clientId}:${namespace}:`)) cache.delete(key);
    } else if (clientId) {
      if (key.startsWith(`${clientId}:`)) cache.delete(key);
    } else if (namespace) {
      if (key.includes(`:${namespace}:`)) cache.delete(key);
    }
  }
}
