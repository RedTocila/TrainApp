"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardDayPager } from "@/components/dashboard-day-pager";
import type { ClientSchedule } from "@/lib/daily-tasks";

/**
 * Calendar strip + horizontal day-page scroller for the home dashboard.
 * Measures strip height into --dashboard-day-pager-top for page sizing.
 */
export function DashboardHomeShell({
  clientId,
  schedule,
  accountCreatedAt,
  children,
}: {
  clientId: string;
  schedule: ClientSchedule;
  accountCreatedAt?: string | null;
  children: () => ReactNode;
}) {
  const topRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = topRef.current;
    if (!node) return;

    const apply = () => {
      const main = document.querySelector<HTMLElement>(".dashboard-main");
      if (!main) return;
      const mainTop = main.getBoundingClientRect().top;
      const bottom = node.getBoundingClientRect().bottom;
      const offset = Math.max(0, Math.round(bottom - mainTop));
      main.style.setProperty("--dashboard-day-pager-top", `${offset}px`);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-col">
      <div ref={topRef} className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6">
        <DashboardCalendar clientId={clientId} schedule={schedule} />
      </div>
      <DashboardDayPager accountCreatedAt={accountCreatedAt}>
        {children}
      </DashboardDayPager>
    </div>
  );
}
