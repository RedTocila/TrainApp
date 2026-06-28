"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { DashboardDateLoadingContext } from "@/components/dashboard-date-loading";
import {
  dashboardDayCacheKey,
  getDashboardDayCache,
  isDashboardDayCacheFresh,
  setDashboardDayCache,
} from "@/lib/dashboard-day-cache";

export function useCachedDashboardDate<T>({
  clientId,
  dateKey,
  namespace,
  fetcher,
  seed,
  deps = [],
  trackGlobalLoading = false,
  skipFetch,
}: {
  clientId: string;
  dateKey: string;
  namespace: string;
  fetcher: () => Promise<T>;
  seed?: T;
  deps?: unknown[];
  trackGlobalLoading?: boolean;
  /** Skip network when seed/cache already satisfies the view (e.g. enrichment range). */
  skipFetch?: boolean;
}): { data: T | null; isRevalidating: boolean } {
  const ctx = useContext(DashboardDateLoadingContext);
  const markLoading = trackGlobalLoading ? ctx?.markLoading : undefined;
  const cacheKey = dashboardDayCacheKey(clientId, namespace, dateKey);
  const depsKey = JSON.stringify(deps);
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const readCache = useCallback((): T | null => {
    const cached = getDashboardDayCache<T>(cacheKey);
    if (cached !== undefined) return cached;
    return seedRef.current ?? null;
  }, [cacheKey]);

  const [data, setData] = useState<T | null>(readCache);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useLayoutEffect(() => {
    const next = readCache();
    setData((prev) => (Object.is(prev, next) ? prev : next));
  }, [dateKey, readCache]);

  useEffect(() => {
    if (skipFetch && (seed !== undefined || getDashboardDayCache<T>(cacheKey) !== undefined)) {
      setIsRevalidating(false);
      return;
    }

    if (skipFetch && isDashboardDayCacheFresh(cacheKey)) {
      setIsRevalidating(false);
      return;
    }

    let cancelled = false;
    const unregister = markLoading?.(dateKey) ?? (() => {});
    setIsRevalidating(true);

    void fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setDashboardDayCache(cacheKey, result);
        setData(result);
      })
      .finally(() => {
        if (!cancelled) setIsRevalidating(false);
        unregister();
      });

    return () => {
      cancelled = true;
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey encodes refresh triggers
  }, [cacheKey, dateKey, depsKey, markLoading, skipFetch, seed, trackGlobalLoading]);

  return { data, isRevalidating };
}
