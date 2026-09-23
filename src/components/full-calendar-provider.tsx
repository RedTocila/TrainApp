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
  const [hasOpened, setHasOpened] = useState(false);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const pendingOpenRef = useRef(false);

  // Warm the dialog chunk while the user is on the dashboard.
  useEffect(() => {
    if (!hasCalendar) return;
    void import("@/components/full-calendar-dialog");
  }, [hasCalendar]);

  const registerCalendarData = useCallback((data: CalendarData | null) => {
    setCalendarData(data);
    setHasCalendar((current) => {
      const next = data !== null;
      return current === next ? current : next;
    });
    if (data && pendingOpenRef.current) {
      pendingOpenRef.current = false;
      setHasOpened(true);
      setOpen(true);
    }
  }, []);

  const openCalendar = useCallback(() => {
    if (calendarData) {
      setHasOpened(true);
      setOpen(true);
      return;
    }
    // Dashboard home hasn't mounted yet — open once calendar data registers.
    pendingOpenRef.current = true;
  }, [calendarData]);

  const value = useMemo(
    () => ({
      openCalendar,
      hasCalendar,
      registerCalendarData,
    }),
    [openCalendar, hasCalendar, registerCalendarData]
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
    return () => registerCalendarData(null);
  }, [schedule, serialized, registerCalendarData]);
}
