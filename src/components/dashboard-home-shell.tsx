"use client";

import type { ReactNode } from "react";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import type { ClientSchedule } from "@/lib/daily-tasks";

/**
 * Calendar strip + single day content for the home dashboard.
 * Day changes only via calendar taps (no horizontal swipe).
 * Vertical scroll lives on `.dashboard-main`.
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
      <div className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6">
        <DashboardCalendar clientId={clientId} schedule={schedule} />
      </div>
      <div className="flex flex-col gap-3 pb-[var(--dashboard-mobile-nav-height,4.25rem)] pt-3 sm:gap-4 sm:pt-4">
        {children}
      </div>
    </div>
  );
}
