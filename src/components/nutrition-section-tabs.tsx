"use client";

import { usePathname } from "next/navigation";
import { Sparkles, UtensilsCrossed, FolderOpenDot } from "lucide-react";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { InstantNavLink } from "@/components/instant-nav-link";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/dashboard/nutrition",
    label: "Meal Plans",
    icon: FolderOpenDot,
    activeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  {
    href: "/dashboard/nutrition/meals",
    label: "Meals",
    icon: UtensilsCrossed,
    activeClass: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  },
  {
    href: "/dashboard/ai/plans/nutrition",
    label: "AI plan",
    icon: Sparkles,
    activeClass: "border-primary/40 bg-primary/15 text-primary",
  },
] as const;

export function NutritionSectionTabs() {
  const pathname = usePathname();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <nav className="flex gap-2">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || (tab.href !== "/dashboard/ai/plans/nutrition" && pathname.startsWith(`${tab.href}/`));
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
