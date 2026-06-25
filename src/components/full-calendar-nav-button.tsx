"use client";

import { CalendarDays } from "lucide-react";
import { usePathname } from "next/navigation";
import { useFullCalendar } from "@/components/full-calendar-provider";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FullCalendarNavButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { openCalendar, hasCalendar } = useFullCalendar();

  if (pathname !== "/dashboard" || !hasCalendar) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9", className)}
      onClick={openCalendar}
      aria-label={platform.calendar.fullCalendar}
    >
      <CalendarDays className="h-4 w-4" />
    </Button>
  );
}
