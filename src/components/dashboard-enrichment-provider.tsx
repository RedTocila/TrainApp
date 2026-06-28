"use client";

import { addDays, format } from "date-fns";
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
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  fetchDashboardEnrichmentData,
  fetchDashboardEnrichmentForDate,
} from "@/lib/actions/dashboard-enrichment";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { formatDateKey } from "@/lib/utils";

type DashboardEnrichmentContextValue = {
  enrichment: DashboardEnrichmentData;
  clientId: string;
  isInEnrichmentRange: (dateKey: string) => boolean;
};

const DashboardEnrichmentContext =
  createContext<DashboardEnrichmentContextValue | null>(null);

function enrichmentRange() {
  const today = new Date();
  return {
    from: format(addDays(today, -3), "yyyy-MM-dd"),
    to: format(addDays(today, 28), "yyyy-MM-dd"),
  };
}

function mergeEnrichmentDays(
  base: DashboardEnrichmentData,
  day: DashboardEnrichmentData
): DashboardEnrichmentData {
  const workoutSet = new Set(base.workoutCompletedDates);
  for (const date of day.workoutCompletedDates) {
    workoutSet.add(date);
  }

  return {
    ...base,
    completionsByDate: { ...base.completionsByDate, ...day.completionsByDate },
    waterByDate: { ...base.waterByDate, ...day.waterByDate },
    mealsByDate: { ...base.mealsByDate, ...day.mealsByDate },
    workoutCompletedDates: [...workoutSet],
    accountCreatedAt: day.accountCreatedAt ?? base.accountCreatedAt,
  };
}

export function DashboardEnrichmentProvider({
  clientId,
  initialEnrichment,
  children,
}: {
  clientId: string;
  initialEnrichment: DashboardEnrichmentData;
  children: ReactNode;
}) {
  const { version, mergeEnrichment, patches } = useDashboardSync();
  const { todayKey } = useSelectedDate();
  const [enrichment, setEnrichment] =
    useState<DashboardEnrichmentData>(initialEnrichment);
  const inflightRef = useRef<Promise<void> | null>(null);
  const previousTodayKey = useRef(todayKey);
  const range = useMemo(() => enrichmentRange(), [todayKey]);

  const loadRange = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    const request = fetchDashboardEnrichmentData(clientId, range.from, range.to)
      .then((data) => {
        setEnrichment(data);
      })
      .finally(() => {
        if (inflightRef.current === request) {
          inflightRef.current = null;
        }
      });

    inflightRef.current = request;
    return request;
  }, [clientId, range.from, range.to]);

  const loadPatchedDates = useCallback(async () => {
    const dateKeys = new Set<string>([
      ...Object.keys(patches.completions),
      ...Object.keys(patches.water),
      ...Object.keys(patches.meals),
      ...Object.keys(patches.workoutCompleted),
      ...Object.keys(patches.workoutSessionIds),
    ]);

    if (dateKeys.size === 0) {
      await loadRange();
      return;
    }

    const days = await Promise.all(
      [...dateKeys].map((dateKey) =>
        fetchDashboardEnrichmentForDate(clientId, dateKey)
      )
    );

    setEnrichment((current) =>
      days.reduce((acc, day) => mergeEnrichmentDays(acc, day), current)
    );
  }, [clientId, loadRange, patches]);

  useEffect(() => {
    if (version === 0) return;
    void loadPatchedDates();
  }, [version, loadPatchedDates]);

  useEffect(() => {
    if (previousTodayKey.current === todayKey) return;
    previousTodayKey.current = todayKey;
    void loadRange();
  }, [todayKey, loadRange]);

  const mergedEnrichment = useMemo(
    () => mergeEnrichment(enrichment),
    [enrichment, mergeEnrichment]
  );

  const isInEnrichmentRange = useCallback(
    (dateKey: string) => dateKey >= range.from && dateKey <= range.to,
    [range.from, range.to]
  );

  const value = useMemo<DashboardEnrichmentContextValue>(
    () => ({
      enrichment: mergedEnrichment,
      clientId,
      isInEnrichmentRange,
    }),
    [mergedEnrichment, clientId, isInEnrichmentRange]
  );

  return (
    <DashboardEnrichmentContext.Provider value={value}>
      {children}
    </DashboardEnrichmentContext.Provider>
  );
}

export function useDashboardEnrichment() {
  const ctx = useContext(DashboardEnrichmentContext);
  if (!ctx) {
    throw new Error(
      "useDashboardEnrichment must be used within DashboardEnrichmentProvider"
    );
  }
  return ctx;
}

export function useOptionalDashboardEnrichment() {
  return useContext(DashboardEnrichmentContext);
}
