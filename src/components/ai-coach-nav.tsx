"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  FileText,
  LayoutGrid,
  LineChart,
  MessageCircle,
  Salad,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { InstantNavButton } from "@/components/instant-nav-button";
import { InstantNavLink } from "@/components/instant-nav-link";
import { usePrefetchRoutes } from "@/components/use-prefetch-routes";
import { cn } from "@/lib/utils";

const tabs: {
  href?: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  match?: string;
  openChat?: boolean;
}[] = [
  { href: "/dashboard/ai", label: "Home", icon: LayoutGrid, exact: true },
  { label: "Ask", icon: MessageCircle, openChat: true },
  { href: "/dashboard/ai/plans/workout", label: "Workout", icon: Dumbbell, match: "/dashboard/ai/plans/workout" },
  { href: "/dashboard/ai/plans/nutrition", label: "Nutrition", icon: Salad, match: "/dashboard/ai/plans/nutrition" },
  { href: "/dashboard/ai/meal-suggestions", label: "Meals", icon: UtensilsCrossed },
  { href: "/dashboard/ai/recommendations", label: "Tips", icon: Sparkles },
  { href: "/dashboard/ai/predictions", label: "Trend", icon: LineChart },
  { href: "/dashboard/ai/reports", label: "Report", icon: FileText },
];

const inactiveTabClass =
  "border-transparent bg-secondary/40 text-muted-foreground active:bg-secondary active:text-foreground [@media(hover:hover)]:hover:bg-secondary [@media(hover:hover)]:hover:text-foreground";

const tabClassName = (active: boolean) =>
  cn(
    "flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-95 active:opacity-90",
    active ? "border-primary/40 bg-primary/15 text-primary" : inactiveTabClass
  );

export function AiCoachNav() {
  const pathname = usePathname();
  const { isOpen, openChat } = useAiCoachChat();

  const prefetchRoutes = useMemo(
    () => tabs.flatMap((tab) => (tab.href ? [tab.href] : [])),
    []
  );
  usePrefetchRoutes(prefetchRoutes);

  return (
    <nav className="dashboard-instant-nav dashboard-instant-nav--scroll flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.openChat
          ? isOpen
          : tab.exact
            ? pathname === tab.href
            : tab.match
              ? pathname === tab.match
              : tab.href
                ? pathname.startsWith(tab.href)
                : false;
        const Icon = tab.icon;

        if (tab.openChat) {
          return (
            <InstantNavButton
              key={tab.label}
              onAction={openChat}
              className={tabClassName(active)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            </InstantNavButton>
          );
        }

        return (
          <InstantNavLink
            key={tab.href}
            href={tab.href!}
            className={tabClassName(active)}
            tapSlop={16}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
          </InstantNavLink>
        );
      })}
    </nav>
  );
}
