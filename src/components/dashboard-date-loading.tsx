"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  const [pendingByDate, setPendingByDate] = useState<Record<string, number>>({});
  const [lastSettledDate, setLastSettledDate] = useState<string | null>(null);
  const hadPendingForDateRef = useRef(false);

  const markLoading = useCallback((forDateKey: string) => {
    setPendingByDate((prev) => ({
      ...prev,
      [forDateKey]: (prev[forDateKey] ?? 0) + 1,
    }));
    return () => {
      setPendingByDate((prev) => {
        const next = (prev[forDateKey] ?? 1) - 1;
        if (next <= 0) {
          const { [forDateKey]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [forDateKey]: next };
      });
    };
  }, []);

  const pendingForCurrentDate = pendingByDate[dateKey] ?? 0;

  useEffect(() => {
    if (pendingForCurrentDate > 0) {
      hadPendingForDateRef.current = true;
      return;
    }

    if (lastSettledDate === null) {
      setLastSettledDate(dateKey);
      return;
    }

    if (!hadPendingForDateRef.current) return;

    hadPendingForDateRef.current = false;
    setLastSettledDate(dateKey);
  }, [pendingForCurrentDate, dateKey, lastSettledDate]);

  useLayoutEffect(() => {
    hadPendingForDateRef.current = false;
  }, [dateKey]);

  const isDateLoading =
    pendingForCurrentDate > 0 ||
    (lastSettledDate !== null && lastSettledDate !== dateKey);

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

export function useDashboardDateLoading() {
  const ctx = useContext(DashboardDateLoadingContext);
  return ctx?.isDateLoading ?? false;
}

export function DashboardDateLoadingDots({
  className,
  showLabel = false,
  variant = "inline",
}: {
  className?: string;
  showLabel?: boolean;
  variant?: "inline" | "container";
}) {
  const isDateLoading = useDashboardDateLoading();
  if (!isDateLoading) return null;

  const dots = (
    <>
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
      {showLabel && (
        <span className="text-xs font-medium text-primary">
          Loading results…
        </span>
      )}
    </>
  );

  if (variant === "container") {
    return (
      <div className="mt-3 flex justify-center">
        <div
          className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 shadow-sm shadow-primary/5"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading day"
        >
          <div className="coach-alex-nav-loading__dots justify-center gap-2">
            {dots}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "coach-alex-nav-loading__dots justify-start py-1"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading day"
    >
      {dots}
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

  useLayoutEffect(() => {
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
