"use client";

import { useSelectedDate } from "@/components/date-provider";
import { CalendarStrip } from "@/components/calendar-strip";
import { useDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";
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
    <div className="relative">
      <div className="absolute right-3 top-2 z-10 hidden lg:block md:right-6">
        <FullCalendarNavButton className="h-9 w-9 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-sm" />
      </div>
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        schedule={schedule}
        enrichment={enrichment}
      />
    </div>
  );
}
