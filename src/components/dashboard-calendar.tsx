"use client";

import { addDays, format } from "date-fns";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarStrip } from "@/components/calendar-strip";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";
import { useRegisterDashboardCalendar } from "@/components/full-calendar-provider";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

interface DashboardCalendarProps {
  clientId: string;
  schedule: ClientSchedule;
  initialEnrichment: DashboardEnrichmentData;
}

export function DashboardCalendar({
  clientId,
  schedule,
  initialEnrichment,
}: DashboardCalendarProps) {
  const { selectedDate, setSelectedDate, todayKey } = useSelectedDate();
  const { version, mergeEnrichment } = useDashboardSync();
  const [enrichment, setEnrichment] =
    useState<DashboardEnrichmentData>(initialEnrichment);
  const [, startTransition] = useTransition();
  const previousTodayKey = useRef(todayKey);

  const mergedEnrichment = useMemo(
    () => mergeEnrichment(enrichment),
    [enrichment, mergeEnrichment]
  );

  const range = useMemo(() => {
    const today = new Date();
    return {
      from: format(addDays(today, -3), "yyyy-MM-dd"),
      to: format(addDays(today, 28), "yyyy-MM-dd"),
    };
  }, [todayKey]);

  useEffect(() => {
    if (version === 0) return;

    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(
        clientId,
        range.from,
        range.to
      );
      setEnrichment(data);
    });
  }, [clientId, range.from, range.to, version]);

  useEffect(() => {
    if (previousTodayKey.current === todayKey) return;
    previousTodayKey.current = todayKey;

    startTransition(async () => {
      const data = await fetchDashboardEnrichmentData(
        clientId,
        range.from,
        range.to
      );
      setEnrichment(data);
    });
  }, [todayKey, clientId, range.from, range.to]);

  useRegisterDashboardCalendar(schedule, mergedEnrichment);

  return (
    <div className="relative">
      <div className="absolute right-3 top-2 z-10 hidden lg:block md:right-6">
        <FullCalendarNavButton className="h-9 w-9 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-sm" />
      </div>
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        schedule={schedule}
        enrichment={mergedEnrichment}
      />
    </div>
  );
}
