"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { useNutritionPageChromeActions } from "@/components/nutrition-page-chrome-context";
import { InstantNavLink } from "@/components/instant-nav-link";
import { buttonVariants } from "@/components/ui/button";
import {
  DASHBOARD_DAY_NUTRITION_PATH,
  DASHBOARD_DAY_WORKOUT_PATH,
} from "@/lib/dashboard-day-routes";
import { cn } from "@/lib/utils";

export function DashboardDayDetailShell({
  children,
  backHref = "/dashboard",
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const nutritionActions = useNutritionPageChromeActions();
  const { setPendingHref } = useDashboardNavPending();
  const hideBackOnMobile =
    pathname === DASHBOARD_DAY_NUTRITION_PATH ||
    pathname === DASHBOARD_DAY_WORKOUT_PATH;
  const headerTrailing = nutritionActions?.headerTrailing ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-1">
      <div
        className={cn(
          "flex items-center gap-3",
          hideBackOnMobile ? "justify-end lg:justify-between" : "justify-between",
          hideBackOnMobile && !headerTrailing && "max-lg:hidden"
        )}
      >
        <InstantNavLink
          href={backHref}
          exactMatch={backHref === "/dashboard"}
          onNavigateStart={setPendingHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 h-9 gap-1.5 px-2",
            hideBackOnMobile && "hidden lg:inline-flex"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          {platform.common.back}
        </InstantNavLink>
        {headerTrailing}
      </div>
      {children}
    </div>
  );
}
