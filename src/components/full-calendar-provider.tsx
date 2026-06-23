"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FullCalendarDialog } from "@/components/full-calendar-dialog";
import { useSelectedDate } from "@/components/date-provider";
import type { ClientSchedule } from "@/lib/daily-tasks";

interface CalendarData {
  schedule: ClientSchedule;
  completionsByDate: Record<string, Set<string>>;
}

interface FullCalendarContextValue {
  openCalendar: () => void;
  hasCalendar: boolean;
  registerCalendarData: (data: CalendarData | null) => void;
}

const FullCalendarContext = createContext<FullCalendarContextValue | null>(null);

function toCompletionSets(
  map: Record<string, string[]>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [date, ids] of Object.entries(map)) {
    out[date] = new Set(ids);
  }
  return out;
}

export function FullCalendarProvider({ children }: { children: ReactNode }) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [open, setOpen] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);

  const registerCalendarData = useCallback((data: CalendarData | null) => {
    setCalendarData(data);
  }, []);

  const value = useMemo(
    () => ({
      openCalendar: () => setOpen(true),
      hasCalendar: calendarData !== null,
      registerCalendarData,
    }),
    [calendarData, registerCalendarData]
  );

  return (
    <FullCalendarContext.Provider value={value}>
      {children}
      {calendarData && (
        <FullCalendarDialog
          open={open}
          onClose={() => setOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          schedule={calendarData.schedule}
          completionsByDate={calendarData.completionsByDate}
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
  completionsByDate: Record<string, string[]>
) {
  const { registerCalendarData } = useFullCalendar();

  const serialized = useMemo(
    () => JSON.stringify(completionsByDate),
    [completionsByDate]
  );

  useEffect(() => {
    registerCalendarData({
      schedule,
      completionsByDate: toCompletionSets(completionsByDate),
    });
    return () => registerCalendarData(null);
  }, [schedule, serialized, registerCalendarData, completionsByDate]);
}
