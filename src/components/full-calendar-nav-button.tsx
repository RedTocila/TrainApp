"use client";

import { usePathname } from "next/navigation";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { useFullCalendar } from "@/components/full-calendar-provider";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { showsFullCalendarNav } from "@/lib/train-nav";
import { cn } from "@/lib/utils";

function useShowFullCalendarNav() {
  const pathname = usePathname();
  const { pendingHref } = useDashboardNavPending();
  const { hasCalendar } = useFullCalendar();
  return hasCalendar && showsFullCalendarNav(pendingHref ?? pathname);
}

export function FullCalendarOpenButton({ className }: { className?: string }) {
  const platform = usePlatformCopy();
  const { openCalendar } = useFullCalendar();
  const visible = useShowFullCalendarNav();

  if (!visible) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto shrink-0 px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={openCalendar}
    >
      {platform.calendar.fullCalendar}
    </Button>
  );
}
