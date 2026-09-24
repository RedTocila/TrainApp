"use client";

import { usePathname } from "next/navigation";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";
import { hidesDashboardChrome, showsTrainSectionTabs } from "@/lib/train-nav";
import { TrainSectionTabs } from "@/components/train-section-tabs";

export function TrainSectionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pendingHref } = useDashboardNavPending();
  const chromePath = pendingHref ?? pathname;

  if (hidesDashboardChrome(chromePath) || !showsTrainSectionTabs(chromePath)) {
    return children;
  }

  return (
    <>
      <div className="mb-3 hidden items-center gap-3 lg:flex">
        <TrainSectionTabs className="mb-0 min-w-0 flex-1" />
        <FullCalendarNavButton className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/80 shadow-sm" />
      </div>
      {children}
    </>
  );
}
