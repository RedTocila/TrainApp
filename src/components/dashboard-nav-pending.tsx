"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isNavRouteMatch } from "@/lib/nav-route-match";

/** List roots that should only match the pathname exactly (not child edit routes). */
const EXACT_PENDING_HREFS = new Set(["/dashboard/workout", "/dashboard/nutrition"]);

function pendingRouteSatisfied(pathname: string, pendingHref: string) {
  const exact = EXACT_PENDING_HREFS.has(pendingHref);
  return isNavRouteMatch(pathname, pendingHref, exact);
}

interface DashboardNavPendingContextValue {
  pendingHref: string | null;
  setPendingHref: (href: string | null) => void;
  routeLoadingCount: number;
  beginRouteLoading: () => void;
  endRouteLoading: () => void;
}

const DashboardNavPendingContext =
  createContext<DashboardNavPendingContextValue | null>(null);

export function DashboardNavPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [routeLoadingCount, setRouteLoadingCount] = useState(0);

  const beginRouteLoading = useCallback(() => {
    setRouteLoadingCount((count) => count + 1);
  }, []);

  const endRouteLoading = useCallback(() => {
    setRouteLoadingCount((count) => Math.max(0, count - 1));
  }, []);

  useEffect(() => {
    if (!pendingHref || !pendingRouteSatisfied(pathname, pendingHref)) return;
    if (routeLoadingCount > 0) return;
    setPendingHref(null);
  }, [pathname, pendingHref, routeLoadingCount]);

  const value = useMemo(
    () => ({
      pendingHref,
      setPendingHref,
      routeLoadingCount,
      beginRouteLoading,
      endRouteLoading,
    }),
    [pendingHref, routeLoadingCount, beginRouteLoading, endRouteLoading]
  );

  return (
    <DashboardNavPendingContext.Provider value={value}>
      {children}
    </DashboardNavPendingContext.Provider>
  );
}

export function useDashboardNavPending() {
  const ctx = useContext(DashboardNavPendingContext);
  if (!ctx) {
    throw new Error(
      "useDashboardNavPending must be used within DashboardNavPendingProvider"
    );
  }
  return ctx;
}
