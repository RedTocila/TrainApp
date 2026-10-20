"use client";

import type { ReactNode } from "react";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import type { ClientSchedule } from "@/lib/daily-tasks";

/**
 * Calendar strip + single day content for the home dashboard.
 * Day changes only via calendar taps (no horizontal swipe).
 * Vertical scroll: document on mobile (native pull-to-refresh), `.dashboard-main` on desktop.
 */
export function DashboardHomeShell({
  clientId,
  schedule,
  children,
}: {
  clientId: string;
  schedule: ClientSchedule;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <DashboardCalendar clientId={clientId} schedule={schedule} />
      <div className="flex flex-col gap-4 pb-[var(--dashboard-mobile-nav-height,4.25rem)] sm:gap-5 md:gap-6 lg:gap-6 lg:pt-1">
        {children}
      </div>
    </div>
  );
}
