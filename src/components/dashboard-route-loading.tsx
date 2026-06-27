"use client";

import { useLayoutEffect } from "react";
import { CoachAlexNavLoading } from "@/components/coach-alex-nav-loading";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";

/** Next.js `loading.tsx` fallback — hides chrome and shows Coach Alex loading. */
export function DashboardRouteLoading() {
  const { beginRouteLoading, endRouteLoading } = useDashboardNavPending();

  useLayoutEffect(() => {
    beginRouteLoading();
    return () => endRouteLoading();
  }, [beginRouteLoading, endRouteLoading]);

  return <CoachAlexNavLoading />;
}
