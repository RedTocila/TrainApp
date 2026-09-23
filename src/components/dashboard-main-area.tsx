"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardMobileChrome } from "@/components/dashboard-mobile-chrome";
import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";
import { NutritionPageChromeProvider } from "@/components/nutrition-page-chrome-context";
import { WorkoutPageChromeProvider } from "@/components/workout-page-chrome-context";
import { ProgressPhotosPageChromeProvider } from "@/components/progress-photos-page-chrome-context";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { TrainSectionShell } from "@/components/train-section-shell";
import { scrollDashboardMainToTop } from "@/components/dashboard-main-reset";
import { cn } from "@/lib/utils";
import { hidesDashboardChrome } from "@/lib/train-nav";

export function DashboardMainArea({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref, routeLoadingCount } = useDashboardNavPending();
  const isNavigating = pendingHref !== null || routeLoadingCount > 0;
  const showPendingSkeleton =
    pendingHref !== null && routeLoadingCount === 0;
  const fadeOnly = hidesDashboardChrome(
    showPendingSkeleton && pendingHref ? pendingHref : pathname
  );

  useEffect(() => {
    if (!isNavigating) return;
    scrollDashboardMainToTop();
  }, [isNavigating]);

  return (
    <NutritionPageChromeProvider>
      <WorkoutPageChromeProvider>
        <ProgressPhotosPageChromeProvider>
          <DashboardMobileChrome />
          <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
            <TrainSectionShell>
              {showPendingSkeleton ? (
                <div
                  className={cn("page-enter", fadeOnly && "page-enter--fade")}
                  key={`skeleton-${pendingHref}`}
                >
                  <DashboardPageSkeleton href={pendingHref} />
                </div>
              ) : (
                <div
                  className={cn("page-enter", fadeOnly && "page-enter--fade")}
                  key={pathname}
                >
                  {children}
                </div>
              )}
            </TrainSectionShell>
          </div>
        </ProgressPhotosPageChromeProvider>
      </WorkoutPageChromeProvider>
    </NutritionPageChromeProvider>
  );
}
