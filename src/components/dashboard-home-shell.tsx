"use client";

import type { ReactNode } from "react";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardDayPager } from "@/components/dashboard-day-pager";
import type { ClientSchedule } from "@/lib/daily-tasks";

/**
 * Calendar strip + horizontal day-page scroller for the home dashboard.
 * Vertical scroll lives on `.dashboard-main`, so the header and calendar
 * move off-screen with the day content (nothing sticky).
 */
export function DashboardHomeShell({
  clientId,
  schedule,
  accountCreatedAt,
  children,
}: {
  clientId: string;
  schedule: ClientSchedule;
  accountCreatedAt?: string | null;
  children: () => ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6">
        <DashboardCalendar clientId={clientId} schedule={schedule} />
      </div>
      <DashboardDayPager accountCreatedAt={accountCreatedAt}>
        {children}
      </DashboardDayPager>
    </div>
  );
}
