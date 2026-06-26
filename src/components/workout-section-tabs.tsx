"use client";

import { usePathname } from "next/navigation";
import { Dumbbell, HeartPulse, Library } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { InstantNavLink } from "@/components/instant-nav-link";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/dashboard/workout",
    label: "Workouts",
    icon: Dumbbell,
    activeClass: "border-primary/40 bg-primary/15 text-primary",
  },
  {
    href: "/dashboard/workout/exercises",
    label: "Exercises",
    icon: Library,
    activeClass: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  },
  {
    href: "/dashboard/workout/cardio",
    label: "Cardio",
    icon: HeartPulse,
    activeClass: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  },
] as const;

export function WorkoutSectionTabs() {
  const pathname = usePathname();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <nav className="flex gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <InstantNavLink
            key={tab.href}
            href={tab.href}
            onNavigateStart={setPendingHref}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 transition-colors",
              active
                ? tab.activeClass
                : "border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs font-bold">{tab.label}</span>
          </InstantNavLink>
        );
      })}
    </nav>
  );
}
