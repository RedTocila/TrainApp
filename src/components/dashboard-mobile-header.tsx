"use client";

import { AppLogo } from "@/components/app-logo";
import { FullCalendarNavButton } from "@/components/full-calendar-nav-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const headerSurface =
  "rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-card/75";

export function DashboardMobileHeader() {
  return (
    <header className="sticky top-0 z-40 bg-transparent lg:hidden">
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 pb-2.5 sm:px-4 sm:pb-3",
          "pt-[max(0.625rem,env(safe-area-inset-top,0px))]"
        )}
      >
        <div className={cn(headerSurface, "px-3 py-2")}>
          <AppLogo href="/dashboard" size="sm" />
        </div>
        <div className={cn(headerSurface, "flex items-center gap-1 p-1")}>
          <ThemeToggle
            className="h-9 w-9 rounded-xl border-0 bg-transparent hover:bg-secondary/80"
          />
          <FullCalendarNavButton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </header>
  );
}
