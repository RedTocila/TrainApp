"use client";

import { AppLogo } from "@/components/app-logo";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";

export function DashboardMobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
      <AppLogo href="/dashboard" />
      <FullCalendarNavButton />
    </header>
  );
}
