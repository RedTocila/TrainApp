"use client";

import { ArrowLeft } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { useNutritionPageChromeActions } from "@/components/nutrition-page-chrome-context";
import { InstantNavLink } from "@/components/instant-nav-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardDayDetailShell({
  children,
  backHref = "/dashboard",
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const platform = usePlatformCopy();
  const nutritionActions = useNutritionPageChromeActions();
  const { setPendingHref } = useDashboardNavPending();

  return (
    <div className="mx-auto max-w-3xl space-y-1">
      <div className="flex items-center justify-between gap-3">
        <InstantNavLink
          href={backHref}
          exactMatch={backHref === "/dashboard"}
          onNavigateStart={setPendingHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 h-9 gap-1.5 px-2"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          {platform.common.back}
        </InstantNavLink>
        {nutritionActions?.headerTrailing ?? null}
      </div>
      {children}
    </div>
  );
}
