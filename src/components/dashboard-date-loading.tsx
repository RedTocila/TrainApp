"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSelectedDate } from "@/components/date-provider";
import { CoachAlexNavLoading } from "@/components/coach-alex-nav-loading";
import { formatDateKey } from "@/lib/utils";

type DashboardDateLoadingContextValue = {
  markLoading: (loadKey: string) => () => void;
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
  const [settledKey, setSettledKey] = useState(dateKey);
  const pendingRef = useRef(0);
  const activeKeyRef = useRef(dateKey);

  activeKeyRef.current = dateKey;

  const markLoading = useCallback((loadKey: string) => {
    pendingRef.current += 1;
    let released = false;

    return () => {
      if (released) return;
      released = true;
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (
        pendingRef.current === 0 &&
        loadKey === activeKeyRef.current
      ) {
        setSettledKey(loadKey);
      }
    };
  }, []);

  const isLoading = settledKey !== dateKey;

  return (
    <DashboardDateLoadingContext.Provider value={{ markLoading }}>
      {isLoading ? <CoachAlexNavLoading /> : null}
      <div className={isLoading ? "hidden" : undefined} aria-hidden={isLoading}>
        {children}
      </div>
    </DashboardDateLoadingContext.Provider>
  );
}

export function useDashboardDateFetch(
  loadKey: string,
  fetcher: () => Promise<void>
) {
  const ctx = useContext(DashboardDateLoadingContext);

  useEffect(() => {
    let cancelled = false;
    const release = ctx?.markLoading(loadKey);

    void fetcher().finally(() => {
      if (!cancelled) release?.();
    });

    return () => {
      cancelled = true;
      release?.();
    };
  }, [ctx, loadKey, fetcher]);
}
