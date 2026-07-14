"use client";

import { usePathname } from "next/navigation";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { isActiveWorkoutSessionPath, isTrainPath } from "@/lib/train-nav";
import { TrainSectionTabs } from "@/components/train-section-tabs";

export function TrainSectionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pendingHref } = useDashboardNavPending();
  const chromePath = pendingHref ?? pathname;

  if (!isTrainPath(chromePath) || isActiveWorkoutSessionPath(chromePath)) {
    return children;
  }

  return (
    <>
      <div className="mb-3 hidden lg:block">
        <TrainSectionTabs className="mb-0" />
      </div>
      {children}
    </>
  );
}
