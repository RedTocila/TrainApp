"use client";

import { useEffect, type ReactNode } from "react";
import { DashboardMobileChrome } from "@/components/dashboard-mobile-chrome";
import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";
import { NutritionPageChromeProvider } from "@/components/nutrition-page-chrome-context";
import { WorkoutPageChromeProvider } from "@/components/workout-page-chrome-context";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { TrainSectionShell } from "@/components/train-section-shell";
import { scrollDashboardMainToTop } from "@/components/dashboard-main-reset";

export function DashboardMainArea({
  children,
  subscriptionBanner,
}: {
  children: ReactNode;
  subscriptionBanner: ReactNode;
}) {
  const { pendingHref, routeLoadingCount } = useDashboardNavPending();
  const isNavigating = pendingHref !== null || routeLoadingCount > 0;
  const showPendingSkeleton =
    pendingHref !== null && routeLoadingCount === 0;

  useEffect(() => {
    if (!isNavigating) return;
    scrollDashboardMainToTop();
  }, [isNavigating]);

  return (
    <NutritionPageChromeProvider>
      <WorkoutPageChromeProvider>
        <DashboardMobileChrome />
        <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
          {subscriptionBanner}
          <TrainSectionShell>
            {showPendingSkeleton ? (
              <DashboardPageSkeleton href={pendingHref} />
            ) : (
              children
            )}
          </TrainSectionShell>
        </div>
      </WorkoutPageChromeProvider>
    </NutritionPageChromeProvider>
  );
}
