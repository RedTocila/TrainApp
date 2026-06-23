"use client";

import { AppLogo } from "@/components/app-logo";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardMobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4 sm:py-3 lg:hidden">
      <AppLogo href="/dashboard" size="sm" />
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <FullCalendarNavButton />
      </div>
    </header>
  );
}
