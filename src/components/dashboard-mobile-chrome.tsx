"use client";

import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { ReferralNavButton } from "@/components/full-calendar-nav-button";
import { SupportContactButton } from "@/components/support-contact-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrainSectionTabs } from "@/components/train-section-tabs";
import { cn } from "@/lib/utils";
import { isActiveWorkoutSessionPath, isTrainPath } from "@/lib/train-nav";

const headerSurface =
  "rounded-full border border-border/70 bg-card/90 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-card/75";

const headerIconButton =
  "h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/60 p-0 shadow-sm transition-colors hover:bg-secondary/80 hover:text-foreground";

function DashboardMobileHeaderBar() {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
      )}
    >
      <AppLogo
        href="/dashboard"
        variant="text"
        size="lg"
        className="text-3xl text-foreground sm:text-4xl dark:text-white"
      />
      <div className={cn(headerSurface, "flex items-center gap-1.5 p-1.5")}>
        <SupportContactButton buttonClassName={headerIconButton} />
        <ThemeToggle className={headerIconButton} />
        <ReferralNavButton className={headerIconButton} />
      </div>
    </div>
  );
}

/** Mobile top chrome: logo row + program tabs, scrolls with page content. */
export function DashboardMobileChrome() {
  const pathname = usePathname();
  const showTrainTabs =
    isTrainPath(pathname) && !isActiveWorkoutSessionPath(pathname);

  return (
    <div className="mobile-top-safe shrink-0 bg-background lg:hidden">
      <DashboardMobileHeaderBar />
      {showTrainTabs ? (
        <div className="px-3 pb-3 sm:px-4">
          <TrainSectionTabs className="mb-0" />
        </div>
      ) : null}
    </div>
  );
}
