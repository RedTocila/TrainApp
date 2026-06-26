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
import { useSelectedDate } from "@/components/date-provider";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

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

export function FullCalendarProvider({ children }: { children: ReactNode }) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [open, setOpen] = useState(false);
  const [hasCalendar, setHasCalendar] = useState(false);
  const calendarDataRef = useRef<CalendarData | null>(null);

  const registerCalendarData = useCallback((data: CalendarData | null) => {
    calendarDataRef.current = data;
    setHasCalendar((current) => {
      const next = data !== null;
      return current === next ? current : next;
    });
  }, []);

  const value = useMemo(
    () => ({
      openCalendar: () => setOpen(true),
      hasCalendar,
      registerCalendarData,
    }),
    [hasCalendar, registerCalendarData]
  );

  const calendarData = calendarDataRef.current;

  return (
    <FullCalendarContext.Provider value={value}>
      {children}
      {open && calendarData && (
        <FullCalendarDialog
          open={open}
          onClose={() => setOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          schedule={calendarData.schedule}
          enrichment={calendarData.enrichment}
        />
      )}
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
    return () => registerCalendarData(null);
  }, [schedule, serialized, registerCalendarData]);
}
