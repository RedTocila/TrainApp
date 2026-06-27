"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSelectedDate } from "@/components/date-provider";
import { formatDateKey } from "@/lib/utils";

type DashboardDateLoadingContextValue = {
  markLoading: (dateKey: string) => () => void;
  isDateLoading: boolean;
};

const DashboardDateLoadingContext =
  createContext<DashboardDateLoadingContextValue | null>(null);

export function DashboardDateLoadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [loads, setLoads] = useState<{ id: string; dateKey: string }[]>([]);
  const [settledDateKey, setSettledDateKey] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const markLoading = useCallback((forDateKey: string) => {
    const id = crypto.randomUUID();
    setLoads((prev) => [...prev, { id, dateKey: forDateKey }]);
    return () => setLoads((prev) => prev.filter((load) => load.id !== id));
  }, []);

  const pendingForCurrentDate = loads.filter((load) => load.dateKey === dateKey).length;

  useEffect(() => {
    if (pendingForCurrentDate === 0) {
      setSettledDateKey(dateKey);
      hasInitialized.current = true;
    }
  }, [pendingForCurrentDate, dateKey]);

  const isDateLoading =
    hasInitialized.current && settledDateKey !== dateKey;

  const value = useMemo<DashboardDateLoadingContextValue>(
    () => ({ markLoading, isDateLoading }),
    [markLoading, isDateLoading]
  );

  return (
    <DashboardDateLoadingContext.Provider value={value}>
      {children}
    </DashboardDateLoadingContext.Provider>
  );
}

export function DashboardDateLoadingDots() {
  const ctx = useContext(DashboardDateLoadingContext);
  if (!ctx?.isDateLoading) return null;

  return (
    <div
      className="coach-alex-nav-loading__dots justify-start py-1"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading day"
    >
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
    </div>
  );
}

export function useDashboardDateFetch(
  dateKey: string,
  fetcher: () => Promise<void>,
  deps: unknown[] = []
): boolean {
  const ctx = useContext(DashboardDateLoadingContext);
  const markLoading = ctx?.markLoading;
  const [settledKey, setSettledKey] = useState(dateKey);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    const unregister = markLoading?.(dateKey) ?? (() => {});

    void fetcher().finally(() => {
      if (!cancelled) setSettledKey(dateKey);
      unregister();
    });

    return () => {
      cancelled = true;
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey encodes refresh triggers
  }, [dateKey, depsKey, fetcher, markLoading]);

  return settledKey === dateKey;
}
