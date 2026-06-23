"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, Dumbbell } from "lucide-react";
import { isTrainTabActive, trainTabs } from "@/lib/train-nav";
import { cn } from "@/lib/utils";

const tabConfig = {
  "/dashboard/workout": {
    label: "Workout",
    icon: Dumbbell,
    activeClass: "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40",
  },
  "/dashboard/nutrition": {
    label: "Nutrition",
    icon: Apple,
    activeClass: "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/40",
  },
} as const;

export function TrainSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 rounded-2xl border-2 border-border bg-card p-1.5 shadow-sm">
      <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Programs
      </p>
      <div className="flex gap-1.5">
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
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition-all",
                active
                  ? cn(config.activeClass, "font-bold scale-[1.02]")
                  : "bg-secondary/50 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
              {config.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
