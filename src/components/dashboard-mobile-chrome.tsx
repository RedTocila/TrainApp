"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  ArrowLeft,
  Camera,
  ClipboardList,
  Dumbbell,
  Gift,
  ImageIcon,
  Play,
} from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import {
  FullCalendarNavButton,
} from "@/components/full-calendar-nav-button";
import { SupportContactButton } from "@/components/support-contact-button";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { InstantNavLink } from "@/components/instant-nav-link";
import { useNutritionPageChromeActions } from "@/components/nutrition-page-chrome-context";
import { useWorkoutPageChromeActions } from "@/components/workout-page-chrome-context";
import { DashboardStatusCheck, DashboardStatusIcon } from "@/components/section-completed-badge";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { usePlatformCopy } from "@/components/locale-provider";
import { TrainSectionTabs } from "@/components/train-section-tabs";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_DAY_NUTRITION_PATH,
  DASHBOARD_DAY_WORKOUT_PATH,
  DASHBOARD_PROGRESS_PHOTOS_PATH,
} from "@/lib/dashboard-day-routes";
import { cn } from "@/lib/utils";
import { isActiveWorkoutSessionPath, isTrainPath } from "@/lib/train-nav";

const headerSurface =
  "rounded-full border border-border/70 bg-card/90 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-card/75";

const headerIconButton =
  "h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/60 p-0 shadow-sm transition-colors hover:bg-secondary/80 hover:text-foreground";

const headerActionsGroup = "flex items-center gap-1.5";

const headerTextButton =
  "h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm";

function DashboardMobileHeaderBar({ showCalendar }: { showCalendar: boolean }) {
  const pathname = usePathname();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const chromePath = pendingHref ?? pathname;
  const platform = usePlatformCopy();
  const nutritionActions = useNutritionPageChromeActions();
  const workoutActions = useWorkoutPageChromeActions();
  const isNutritionPage = chromePath === DASHBOARD_DAY_NUTRITION_PATH;
  const isWorkoutPage = chromePath === DASHBOARD_DAY_WORKOUT_PATH;
  const isProgressPhotosPage = chromePath === DASHBOARD_PROGRESS_PHOTOS_PATH;

  return (
    <div
      className={cn(
        "flex min-h-[2.75rem] items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2"
      )}
    >
      {isNutritionPage ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <InstantNavLink
            href="/dashboard"
            exactMatch
            onNavigateStart={setPendingHref}
            aria-label={platform.common.back}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </InstantNavLink>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Apple className="h-6 w-6 shrink-0 text-emerald-400" />
            <span className="truncate text-xl font-black tracking-tight">
              {platform.dashboard.nutrition}
            </span>
            {nutritionActions?.status === "completed" ? (
              <DashboardStatusCheck aria-label={platform.aria.completed} />
            ) : nutritionActions?.status === "over" ? (
              <DashboardStatusIcon status="missed" aria-label="Over limit" />
            ) : null}
          </Link>
        </div>
      ) : isWorkoutPage ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <InstantNavLink
            href="/dashboard"
            exactMatch
            onNavigateStart={setPendingHref}
            aria-label={platform.common.back}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </InstantNavLink>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Dumbbell className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate text-xl font-black tracking-tight">
              {platform.trainTabs.workout}
            </span>
          </Link>
        </div>
      ) : isProgressPhotosPage ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ImageIcon className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate text-xl font-black tracking-tight">
            {platform.photos.title}
          </span>
        </div>
      ) : (
        <AppLogo
          href="/dashboard"
          variant="text"
          size="default"
          className="text-2xl leading-none text-foreground sm:text-3xl dark:text-white"
        />
      )}
      {!isProgressPhotosPage ? (
        isNutritionPage && nutritionActions ? (
          <div className={cn(headerSurface, "flex shrink-0 items-center gap-1.5 p-1.5")}>
            {nutritionActions.onLogMeal ? (
              <Button
                type="button"
                size="sm"
                className={headerTextButton}
                onClick={nutritionActions.onLogMeal}
              >
                <Camera className="h-3.5 w-3.5" />
                {platform.nutrition.logMeal}
              </Button>
            ) : null}
            {nutritionActions.showDietPlan ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(headerTextButton, "max-[380px]:hidden")}
                onClick={nutritionActions.onDietPlan}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {platform.nutrition.viewDietPlan}
              </Button>
            ) : null}
          </div>
        ) : isWorkoutPage ? (
          workoutActions?.showStart ? (
            <div className={cn(headerSurface, "flex shrink-0 items-center gap-1.5 p-1.5")}>
              <StartWorkoutLoadingShell isLoading={workoutActions.isStarting}>
                <Button
                  type="button"
                  size="sm"
                  className={headerTextButton}
                  disabled={workoutActions.disabled || workoutActions.isStarting}
                  onClick={workoutActions.onStartWorkout}
                  aria-busy={workoutActions.isStarting}
                >
                  <Play className="h-3.5 w-3.5" />
                  {platform.workout.startWorkout}
                </Button>
              </StartWorkoutLoadingShell>
            </div>
          ) : null
        ) : (
          <div className={headerActionsGroup}>
            <Link
              href="/dashboard/referrals"
              aria-label={platform.referral.navAria}
              className={cn(
                "relative inline-flex items-center justify-center text-muted-foreground",
                headerIconButton
              )}
            >
              <Gift className="h-4 w-4" />
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
              />
            </Link>
            <SupportContactButton buttonClassName={headerIconButton} />
            {showCalendar ? (
              <FullCalendarNavButton className={headerIconButton} />
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

/** Mobile top chrome: logo row + program tabs, scrolls with page content. */
export function DashboardMobileChrome() {
  const pathname = usePathname();
  const { pendingHref } = useDashboardNavPending();
  const chromePath = pendingHref ?? pathname;
  const isSession = isActiveWorkoutSessionPath(chromePath);
  const showTrainTabs = isTrainPath(chromePath) && !isSession;
  const showCalendar = chromePath === "/dashboard";

  if (isSession) return null;

  return (
    <div className="mobile-top-safe sticky top-0 z-50 shrink-0 bg-background lg:hidden">
      <DashboardMobileHeaderBar showCalendar={showCalendar} />
      {showTrainTabs ? (
        <div className="px-3 pb-2 sm:px-4">
          <TrainSectionTabs className="mb-0" />
        </div>
      ) : null}
    </div>
  );
}
