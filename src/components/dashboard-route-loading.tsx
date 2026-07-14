"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";

/** Next.js `loading.tsx` fallback — page skeleton while the route streams in. */
export function DashboardRouteLoading() {
  const pathname = usePathname();
  const { pendingHref, beginRouteLoading, endRouteLoading } =
    useDashboardNavPending();

  useLayoutEffect(() => {
    beginRouteLoading();
    return () => endRouteLoading();
  }, [beginRouteLoading, endRouteLoading]);

  return <DashboardPageSkeleton href={pendingHref ?? pathname} />;
}
