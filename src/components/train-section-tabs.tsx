"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, Dumbbell } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { isTrainTabActive, trainTabs } from "@/lib/train-nav";
import { cn } from "@/lib/utils";

export function TrainSectionTabs() {
  const pathname = usePathname();
  const platform = usePlatformCopy();

  const tabConfig = {
    "/dashboard/workout": {
      label: platform.trainTabs.workout,
      icon: Dumbbell,
      activeClass: "border-primary/40 bg-primary/15 text-primary",
    },
    "/dashboard/nutrition": {
      label: platform.trainTabs.nutrition,
      icon: Apple,
      activeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    },
  } as const;

  return (
    <nav className="mb-5 flex gap-2">
      {trainTabs.map((tab) => {
        const active = isTrainTabActive(pathname, tab.href);
        const config = tabConfig[tab.href];
        const Icon = config.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 transition-colors",
              active
                ? config.activeClass
                : "border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs font-bold">{config.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
