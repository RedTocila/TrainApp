"use client";

import { useEffect, type ReactNode } from "react";
import { CoachAlexNavLoading } from "@/components/coach-alex-nav-loading";
import { DashboardMobileChrome } from "@/components/dashboard-mobile-chrome";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { TrainSectionShell } from "@/components/train-section-shell";

export function DashboardMainArea({
  children,
  subscriptionBanner,
}: {
  children: ReactNode;
  subscriptionBanner: ReactNode;
}) {
  const { pendingHref, routeLoadingCount } = useDashboardNavPending();
  const hideChrome = pendingHref !== null || routeLoadingCount > 0;
  const showFullPageLoading =
    pendingHref !== null && routeLoadingCount === 0;

  useEffect(() => {
    if (!hideChrome) return;
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (main) main.scrollTop = 0;
  }, [hideChrome]);

  return (
    <>
      {!hideChrome ? <DashboardMobileChrome /> : null}
      <div
        className={
          hideChrome
            ? undefined
            : "px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6"
        }
      >
        {!hideChrome ? subscriptionBanner : null}
        {showFullPageLoading ? (
          <CoachAlexNavLoading />
        ) : routeLoadingCount > 0 ? (
          children
        ) : (
          <TrainSectionShell>{children}</TrainSectionShell>
        )}
      </div>
    </>
  );
}
