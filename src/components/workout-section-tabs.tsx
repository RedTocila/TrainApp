"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, Library } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { CompactSubLink } from "@/components/programs/compact-nav";

const tabs = [
  {
    href: "/dashboard/workout",
    label: "Programs",
    icon: LayoutGrid,
    exactMatch: true,
    activeClass: "bg-primary/15 text-primary",
    isActive: (pathname: string) => pathname === "/dashboard/workout",
  },
  {
    href: "/dashboard/workout/exercises",
    label: "Exercises",
    icon: Library,
    activeClass: "bg-violet-500/15 text-violet-300",
    isActive: (pathname: string) => pathname.startsWith("/dashboard/workout/exercises"),
  },
] as const;

export function WorkoutSectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <nav className={className} aria-label="Workout sections">
      <div className="flex items-center gap-0.5">
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
