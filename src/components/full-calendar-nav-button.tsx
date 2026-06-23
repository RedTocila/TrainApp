"use client";

import { CalendarDays } from "lucide-react";
import { usePathname } from "next/navigation";
import { useFullCalendar } from "@/components/full-calendar-provider";
import { Button } from "@/components/ui/button";

export function FullCalendarNavButton() {
  const pathname = usePathname();
  const { openCalendar, hasCalendar } = useFullCalendar();

  if (pathname !== "/dashboard" || !hasCalendar) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
      onClick={openCalendar}
      aria-label="Full calendar"
    >
      <CalendarDays className="h-4 w-4" />
    </Button>
  );
}
