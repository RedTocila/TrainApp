"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/ai", label: "Overview", exact: true },
  { href: "/dashboard/ai/meal-suggestions", label: "Meals" },
  { href: "/dashboard/ai/recommendations", label: "Tips" },
  { href: "/dashboard/ai/predictions", label: "Predictions" },
  { href: "/dashboard/ai/reports", label: "Reports" },
];

export function AiCoachNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/30 p-1">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
