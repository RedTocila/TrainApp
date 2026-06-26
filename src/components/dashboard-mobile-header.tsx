"use client";

import { AppLogo } from "@/components/app-logo";
import { ReferralNavButton } from "@/components/full-calendar-nav-button";
import { SupportContactButton } from "@/components/support-contact-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const headerSurface =
  "rounded-full border border-border/70 bg-card/90 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-card/75";

const headerIconButton =
  "h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/60 p-0 shadow-sm transition-colors hover:bg-secondary/80 hover:text-foreground";

export function DashboardMobileHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
        )}
      >
        <AppLogo href="/dashboard" size="sm" />
        <div className={cn(headerSurface, "flex items-center gap-1.5 p-1.5")}>
          <SupportContactButton buttonClassName={headerIconButton} />
          <ThemeToggle className={headerIconButton} />
          <ReferralNavButton className={headerIconButton} />
        </div>
      </div>
    </header>
  );
}
