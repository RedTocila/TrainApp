"use client";

import { isToday } from "date-fns";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { useSelectedDate } from "@/components/date-provider";
import { FullCalendarOpenButton } from "@/components/full-calendar-nav-button";
import { Button } from "@/components/ui/button";
import { formatLocalized } from "@/lib/date-locale";

export function DashboardDateHeading() {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const { selectedDate, goToToday } = useSelectedDate();
  const viewingToday = isToday(selectedDate);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
              {formatLocalized(selectedDate, "EEEE, MMMM d", locale)}
            </h1>
            <FullCalendarOpenButton />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {viewingToday
              ? platform.calendar.dailyOverview
              : platform.calendar.overviewFor(
                  formatLocalized(selectedDate, "MMMM d, yyyy", locale)
                )}
          </p>
        </div>
        {!viewingToday && (
          <Button type="button" variant="outline" size="sm" onClick={goToToday}>
            {platform.calendar.today}
          </Button>
        )}
      </div>
    </div>
  );
}
