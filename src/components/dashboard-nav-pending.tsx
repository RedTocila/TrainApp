"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { CoachAlexNavLoading } from "@/components/coach-alex-nav-loading";
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
}

const DashboardNavPendingContext =
  createContext<DashboardNavPendingContextValue | null>(null);

export function DashboardNavPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (pendingHref && pendingRouteSatisfied(pathname, pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  const value = useMemo(
    () => ({ pendingHref, setPendingHref }),
    [pendingHref]
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

export function DashboardNavPendingContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pendingHref } = useDashboardNavPending();
  const isNavigating =
    pendingHref !== null && !pendingRouteSatisfied(pathname, pendingHref);

  useEffect(() => {
    if (!isNavigating) return;
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (main) main.scrollTop = 0;
  }, [isNavigating]);

  if (isNavigating) {
    return <CoachAlexNavLoading />;
  }

  return children;
}
