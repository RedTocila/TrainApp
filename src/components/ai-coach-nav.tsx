"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  FileText,
  LayoutGrid,
  LineChart,
  Salad,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  match?: string;
}[] = [
  { href: "/dashboard/ai", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/dashboard/ai/plans/workout", label: "Workout", icon: Dumbbell, match: "/dashboard/ai/plans/workout" },
  { href: "/dashboard/ai/plans/nutrition", label: "Nutrition", icon: Salad, match: "/dashboard/ai/plans/nutrition" },
  { href: "/dashboard/ai/meal-suggestions", label: "Meals", icon: UtensilsCrossed },
  { href: "/dashboard/ai/recommendations", label: "Tips", icon: Sparkles },
  { href: "/dashboard/ai/predictions", label: "Trend", icon: LineChart },
  { href: "/dashboard/ai/reports", label: "Report", icon: FileText },
];

export function AiCoachNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : tab.match
            ? pathname === tab.match
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-colors",
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
