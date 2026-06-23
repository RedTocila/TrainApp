"use client";

import { format, isToday } from "date-fns";
import { useSelectedDate } from "@/components/date-provider";
import { Button } from "@/components/ui/button";

export function DashboardDateHeading() {
  const { selectedDate, goToToday } = useSelectedDate();
  const viewingToday = isToday(selectedDate);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
          {format(selectedDate, "EEEE, MMMM d")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {viewingToday
            ? "Your daily overview"
            : `Overview for ${format(selectedDate, "MMMM d, yyyy")}`}
        </p>
      </div>
      {!viewingToday && (
        <Button type="button" variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      )}
    </div>
  );
}
