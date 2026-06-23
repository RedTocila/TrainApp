"use client";

import { format, isToday } from "date-fns";
import { useSelectedDate } from "@/components/date-provider";

export function DashboardDateHeading() {
  const { selectedDate } = useSelectedDate();

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight md:text-3xl">
        {format(selectedDate, "EEEE, MMMM d")}
      </h1>
      <p className="text-muted-foreground">
        {isToday(selectedDate)
          ? "Your daily overview"
          : `Overview for ${format(selectedDate, "MMMM d, yyyy")}`}
      </p>
    </div>
  );
}
