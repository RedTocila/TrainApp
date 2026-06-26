"use client";

import { usePathname } from "next/navigation";
import { HeartPulse, LayoutGrid, Library } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { CompactSubLink } from "@/components/programs/compact-nav";

export function WorkoutSectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { setPendingHref } = useDashboardNavPending();

  const tabs = [
    {
      href: "/dashboard/workout",
      label: platform.nav.programs,
      icon: LayoutGrid,
      exactMatch: true,
      activeClass: "bg-primary/15 text-primary",
      isActive: (path: string) => path === "/dashboard/workout",
    },
    {
      href: "/dashboard/workout/exercises",
      label: platform.workout.exercisesTile,
      icon: Library,
      activeClass: "bg-violet-500/15 text-violet-300",
      isActive: (path: string) => path.startsWith("/dashboard/workout/exercises"),
    },
    {
      href: "/dashboard/workout/cardio",
      label: platform.cardio.title,
      icon: HeartPulse,
      activeClass: "bg-orange-500/15 text-orange-300",
      isActive: (path: string) => path.startsWith("/dashboard/workout/cardio"),
    },
  ] as const;

  return (
    <nav className={className} aria-label="Workout sections">
      <div className="flex w-max flex-nowrap items-center gap-0.5">
        {tabs.map((tab) => (
          <CompactSubLink
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={tab.isActive(pathname)}
            activeClass={tab.activeClass}
            onNavigateStart={setPendingHref}
            exactMatch={"exactMatch" in tab ? tab.exactMatch : false}
          />
        ))}
      </div>
    </nav>
  );
}
