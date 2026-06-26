"use client";

import { usePathname } from "next/navigation";
import { Apple, UtensilsCrossed } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { CompactSubLink } from "@/components/programs/compact-nav";

const tabs = [
  {
    href: "/dashboard/nutrition",
    label: "Menus",
    icon: Apple,
    exactMatch: true,
    activeClass: "bg-emerald-500/15 text-emerald-300",
    isActive: (pathname: string) => pathname === "/dashboard/nutrition",
  },
  {
    href: "/dashboard/nutrition/meals",
    label: "Library",
    icon: UtensilsCrossed,
    activeClass: "bg-violet-500/15 text-violet-300",
    isActive: (pathname: string) =>
      pathname.startsWith("/dashboard/nutrition/meals") ||
      pathname.startsWith("/dashboard/nutrition/templates"),
  },
] as const;

export function NutritionSectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <nav className={className} aria-label="Nutrition sections">
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
