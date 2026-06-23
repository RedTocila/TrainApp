"use client";

import { useMemo } from "react";
import { CalendarStrip } from "@/components/calendar-strip";
import { useSelectedDate } from "@/components/date-provider";
import { useRegisterDashboardCalendar } from "@/components/full-calendar-provider";
import type { ClientSchedule } from "@/lib/daily-tasks";

interface DashboardCalendarProps {
  schedule: ClientSchedule;
  completionsByDate: Record<string, string[]>;
}

function toCompletionSets(
  map: Record<string, string[]>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [date, ids] of Object.entries(map)) {
    out[date] = new Set(ids);
  }
  return out;
}

export function DashboardCalendar({
  schedule,
  completionsByDate,
}: DashboardCalendarProps) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  useRegisterDashboardCalendar(schedule, completionsByDate);

  const completionSets = useMemo(
    () => toCompletionSets(completionsByDate),
    [completionsByDate]
  );

  return (
    <div className="border-b border-border bg-card/50">
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        schedule={schedule}
        completionsByDate={completionSets}
      />
    </div>
  );
}
