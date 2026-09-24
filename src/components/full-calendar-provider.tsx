"use client";

import dynamic from "next/dynamic";
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
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useSelectedDate } from "@/components/date-provider";
import { fetchFullCalendarMonthSlice } from "@/lib/actions/full-calendar-month";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import { mergeCalendarSchedule } from "@/lib/full-calendar-merge";

const FullCalendarDialog = dynamic(
  () =>
    import("@/components/full-calendar-dialog").then((mod) => ({
      default: mod.FullCalendarDialog,
    })),
  { ssr: false }
);

interface CalendarData {
  schedule: ClientSchedule;
  enrichment: DashboardEnrichmentData;
}

interface FullCalendarContextValue {
  openCalendar: () => void;
  hasCalendar: boolean;
  registerCalendarData: (data: CalendarData | null) => void;
}

const FullCalendarContext = createContext<FullCalendarContextValue | null>(null);

const EMPTY_ENRICHMENT: DashboardEnrichmentData = {
  completionsByDate: {},
  waterByDate: {},
  mealsByDate: {},
  workoutCompletedDates: [],
};

const EMPTY_SCHEDULE: ClientSchedule = {
  workoutAssignment: null,
  nutritionAssignment: null,
  waterGoalMl: 2500,
};

async function bootstrapCalendarData(): Promise<CalendarData | null> {
  const now = new Date();
  const from = format(startOfWeek(startOfMonth(now)), "yyyy-MM-dd");
  const to = format(endOfWeek(endOfMonth(now)), "yyyy-MM-dd");
  const result = await fetchFullCalendarMonthSlice(
    from,
    to,
    now.getTimezoneOffset()
  );
  if ("error" in result) return null;
  return {
    schedule: mergeCalendarSchedule(EMPTY_SCHEDULE, result.scheduleSlice),
    enrichment: result.enrichment,
  };
}

export function FullCalendarProvider({ children }: { children: ReactNode }) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const pendingOpenRef = useRef(false);
  const calendarDataRef = useRef(calendarData);
  calendarDataRef.current = calendarData;

  // Warm the dialog chunk once.
  useEffect(() => {
    void import("@/components/full-calendar-dialog");
  }, []);

  const registerCalendarData = useCallback((data: CalendarData | null) => {
    // Ignore null clears from home unmount — keep last known data for other tabs.
    if (data === null) return;
    setCalendarData(data);
    if (pendingOpenRef.current) {
      pendingOpenRef.current = false;
      setHasOpened(true);
      setOpen(true);
    }
  }, []);

  const openCalendar = useCallback(() => {
    if (calendarDataRef.current) {
      setHasOpened(true);
      setOpen(true);
      return;
    }
    pendingOpenRef.current = true;
    if (bootstrapping) return;
    setBootstrapping(true);
    void bootstrapCalendarData()
      .then((data) => {
        if (!data) {
          pendingOpenRef.current = false;
          return;
        }
        setCalendarData(data);
        if (pendingOpenRef.current) {
          pendingOpenRef.current = false;
          setHasOpened(true);
          setOpen(true);
        }
      })
      .finally(() => setBootstrapping(false));
  }, [bootstrapping]);

  const value = useMemo(
    () => ({
      openCalendar,
      hasCalendar: true,
      registerCalendarData,
    }),
    [openCalendar, registerCalendarData]
  );

  return (
    <FullCalendarContext.Provider value={value}>
      {children}
      {hasOpened && calendarData ? (
        <FullCalendarDialog
          open={open}
          onClose={() => setOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          schedule={calendarData.schedule}
          enrichment={calendarData.enrichment}
        />
      ) : null}
    </FullCalendarContext.Provider>
  );
}

export function useFullCalendar() {
  const ctx = useContext(FullCalendarContext);
  if (!ctx) {
    throw new Error("useFullCalendar must be used within FullCalendarProvider");
  }
  return ctx;
}

export function useRegisterDashboardCalendar(
  schedule: ClientSchedule,
  enrichment: DashboardEnrichmentData
) {
  const { registerCalendarData } = useFullCalendar();

  const serialized = useMemo(() => JSON.stringify(enrichment), [enrichment]);

  useEffect(() => {
    registerCalendarData({ schedule, enrichment });
  }, [schedule, serialized, registerCalendarData]);
}
