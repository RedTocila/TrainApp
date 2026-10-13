"use client";

import { useSelectedDate } from "@/components/date-provider";
import { CalendarStrip } from "@/components/calendar-strip";
import { useDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { useRegisterDashboardCalendar } from "@/components/full-calendar-provider";
import type { ClientSchedule } from "@/lib/daily-tasks";

export function DashboardCalendar({
  clientId: _clientId,
  schedule,
}: {
  clientId: string;
  schedule: ClientSchedule;
  initialEnrichment?: unknown;
}) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const { enrichment } = useDashboardEnrichment();

  useRegisterDashboardCalendar(schedule, enrichment);

  return (
    <CalendarStrip
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      schedule={schedule}
      enrichment={enrichment}
    />
  );
}
