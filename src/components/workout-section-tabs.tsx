"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, HeartPulse, LayoutGrid } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { CompactSubLink } from "@/components/programs/compact-nav";

function isProgramsSection(path: string) {
  if (path.startsWith("/dashboard/workout/cardio")) return false;
  if (path.startsWith("/dashboard/workout/schedule")) return false;
  if (path.startsWith("/dashboard/workout/session")) return false;
  return (
    path === "/dashboard/workout" ||
    path.startsWith("/dashboard/workout/exercises") ||
    path.startsWith("/dashboard/workout/folder") ||
    path.startsWith("/dashboard/workout/workouts") ||
    path.startsWith("/dashboard/workout/new") ||
    /^\/dashboard\/workout\/[^/]+/.test(path)
  );
}

export function WorkoutSectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const activePath = pendingHref ?? pathname;

  const tabs = [
    {
      href: "/dashboard/workout/schedule",
      label: platform.workout.myWorkout,
      icon: CalendarDays,
      activeClass: "bg-emerald-500/15 text-emerald-300",
      isActive: (path: string) => path.startsWith("/dashboard/workout/schedule"),
    },
    {
      href: "/dashboard/workout",
      label: platform.nav.programs,
      icon: LayoutGrid,
      exactMatch: true,
      activeClass: "bg-primary/15 text-primary",
      isActive: isProgramsSection,
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
            active={tab.isActive(activePath)}
            activeClass={tab.activeClass}
            onNavigateStart={setPendingHref}
            exactMatch={"exactMatch" in tab ? tab.exactMatch : false}
          />
        ))}
      </div>
    </nav>
  );
}
