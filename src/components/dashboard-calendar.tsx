"use client";

import { CalendarStrip } from "@/components/calendar-strip";
import { useSelectedDate } from "@/components/date-provider";

export function DashboardCalendar() {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  return (
    <div className="border-b border-border bg-card/50">
      <CalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
    </div>
  );
}
