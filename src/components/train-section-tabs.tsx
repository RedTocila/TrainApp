"use client";

import { usePathname } from "next/navigation";
import { Apple, Dumbbell } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { CompactSegment } from "@/components/programs/compact-nav";
import { isTrainTabActive, trainTabs } from "@/lib/train-nav";

const tabConfig = {
  "/dashboard/workout": {
    icon: Dumbbell,
    activeClass: "bg-primary/20 text-primary",
  },
  "/dashboard/nutrition": {
    icon: Apple,
    activeClass: "bg-emerald-500/20 text-emerald-400",
  },
} as const;

export function TrainSectionTabs() {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { setPendingHref } = useDashboardNavPending();

  const labels = {
    "/dashboard/workout": platform.trainTabs.workout,
    "/dashboard/nutrition": platform.trainTabs.nutrition,
  } as const;

  return (
    <nav
      className="dashboard-instant-nav mb-3 flex rounded-full bg-secondary/50 p-1"
      aria-label="Programs"
    >
      {trainTabs.map((tab) => {
        const active = isTrainTabActive(pathname, tab.href);
        const config = tabConfig[tab.href];

        return (
          <CompactSegment
            key={tab.href}
            href={tab.href}
            label={labels[tab.href]}
            icon={config.icon}
            active={active}
            activeClass={config.activeClass}
            onNavigateStart={setPendingHref}
            exactMatch
          />
        );
      })}
    </nav>
  );
}
