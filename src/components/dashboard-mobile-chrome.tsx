"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, Camera, ClipboardList, Dumbbell, Play } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import {
  FullCalendarNavButton,
  ReferralNavButton,
} from "@/components/full-calendar-nav-button";
import { SupportContactButton } from "@/components/support-contact-button";
import { useNutritionPageChromeActions } from "@/components/nutrition-page-chrome-context";
import { useWorkoutPageChromeActions } from "@/components/workout-page-chrome-context";
import { DashboardStatusCheck, DashboardStatusIcon } from "@/components/section-completed-badge";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { usePlatformCopy } from "@/components/locale-provider";
import { TrainSectionTabs } from "@/components/train-section-tabs";
import { WorkoutDifficultyInsightButton } from "@/components/workout-difficulty-insight-button";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_DAY_NUTRITION_PATH,
  DASHBOARD_DAY_WORKOUT_PATH,
} from "@/lib/dashboard-day-routes";
import { cn } from "@/lib/utils";
import { isActiveWorkoutSessionPath, isTrainPath } from "@/lib/train-nav";

const headerSurface =
  "rounded-full border border-border/70 bg-card/90 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-card/75";

const headerIconButton =
  "h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/60 p-0 shadow-sm transition-colors hover:bg-secondary/80 hover:text-foreground";

const headerTextButton =
  "h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm";

function DashboardMobileHeaderBar({ showCalendar }: { showCalendar: boolean }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const nutritionActions = useNutritionPageChromeActions();
  const workoutActions = useWorkoutPageChromeActions();
  const isNutritionPage = pathname === DASHBOARD_DAY_NUTRITION_PATH;
  const isWorkoutPage = pathname === DASHBOARD_DAY_WORKOUT_PATH;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
      )}
    >
      {isNutritionPage ? (
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
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
      ) : isWorkoutPage ? (
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <Dumbbell className="h-6 w-6 shrink-0 text-primary" />
          <span className="shrink-0 text-xl font-black tracking-tight">
            {platform.trainTabs.workout}
          </span>
          {workoutActions?.difficultyExercises?.length ? (
            <WorkoutDifficultyInsightButton
              exercises={workoutActions.difficultyExercises}
              intakeProfile={workoutActions.intakeProfile}
              size="compact"
            />
          ) : null}
        </Link>
      ) : (
        <AppLogo
          href="/dashboard"
          variant="text"
          size="lg"
          className="text-3xl text-foreground sm:text-4xl dark:text-white"
        />
      )}
      <div className={cn(headerSurface, "flex items-center gap-1.5 p-1.5")}>
        {isNutritionPage && nutritionActions ? (
          <>
            <Button
              type="button"
              size="sm"
              className={headerTextButton}
              onClick={nutritionActions.onLogMeal}
            >
              <Camera className="h-3.5 w-3.5" />
              {platform.nutrition.logMeal}
            </Button>
            {nutritionActions.showDietPlan ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={headerTextButton}
                onClick={nutritionActions.onDietPlan}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {platform.nutrition.viewDietPlan}
              </Button>
            ) : null}
          </>
        ) : isWorkoutPage && workoutActions ? (
          workoutActions.showCompleted ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : workoutActions.showStart ? (
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
          ) : null
        ) : (
          <>
            <SupportContactButton buttonClassName={headerIconButton} />
            {showCalendar ? (
              <FullCalendarNavButton className={headerIconButton} />
            ) : null}
            <ReferralNavButton className={headerIconButton} />
          </>
        )}
      </div>
    </div>
  );
}

/** Mobile top chrome: logo row + program tabs, scrolls with page content. */
export function DashboardMobileChrome() {
  const pathname = usePathname();
  const showTrainTabs =
    isTrainPath(pathname) && !isActiveWorkoutSessionPath(pathname);
  const showCalendar = pathname === "/dashboard";

  return (
    <div className="mobile-top-safe relative z-50 shrink-0 bg-background lg:hidden">
      <DashboardMobileHeaderBar showCalendar={showCalendar} />
      {showTrainTabs ? (
        <div className="px-3 pb-3 sm:px-4">
          <TrainSectionTabs className="mb-0" />
        </div>
      ) : null}
    </div>
  );
}
