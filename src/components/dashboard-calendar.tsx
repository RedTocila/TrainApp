"use client";

import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarStrip } from "@/components/calendar-strip";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useRegisterDashboardCalendar } from "@/components/full-calendar-provider";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

interface DashboardCalendarProps {
  clientId: string;
  schedule: ClientSchedule;
  completionsByDate: Record<string, string[]>;
}

function buildInitialEnrichment(
  completionsByDate: Record<string, string[]>
): DashboardEnrichmentData {
  return {
    completionsByDate,
    waterByDate: {},
    mealsByDate: {},
    workoutCompletedDates: [],
  };
}

export function DashboardCalendar({
  clientId,
  schedule,
  completionsByDate,
}: DashboardCalendarProps) {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const { version } = useDashboardSync();
  const [enrichment, setEnrichment] = useState<DashboardEnrichmentData>(() =>
    buildInitialEnrichment(completionsByDate)
  );
  const [, startTransition] = useTransition();

  const range = useMemo(() => {
    const today = new Date();
    return {
      from: format(addDays(today, -3), "yyyy-MM-dd"),
      to: format(addDays(today, 28), "yyyy-MM-dd"),
    };
  }, []);

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(
        clientId,
        range.from,
        range.to
      );
      setEnrichment(data);
    });
  }, [clientId, range.from, range.to, version]);

  useRegisterDashboardCalendar(schedule, enrichment);

  return (
    <div className="border-b border-border bg-card/50">
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        schedule={schedule}
        enrichment={enrichment}
      />
    </div>
  );
}
