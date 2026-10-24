"use client";
import { useCoachLabels, useLocale, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useMemo, useState } from "react";
import { isToday } from "date-fns";
import { formatLocalized } from "@/lib/date-locale";
import { Apple, Camera, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
} from "@/components/dashboard-card-nav-link";
import { formatDateKey } from "@/lib/utils";
import { DASHBOARD_DAY_NUTRITION_PATH } from "@/lib/dashboard-day-routes";
import { addWater, updateWaterGoal } from "@/lib/actions/logs";
import { deleteDailyMealLog, updateDailyMealLog } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { MealFormData } from "@/lib/meal-utils";
import { sumMealMacros, mealFormFromMeal } from "@/lib/meal-utils";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import {
  anyDailyMacroOverTarget,
  dailyMacrosExceededUpperLimit,
  dailyMacrosWithinTarget,
  formatExceededMacroSummary,
} from "@/lib/macro-targets";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import { markReminderDone } from "@/lib/reminder-events";
import type { MacroTargets } from "@/lib/meal-score";
import { NutritionStatsPanel } from "@/components/nutrition-stats-panel";
import { NutritionStatusAdviceButton } from "@/components/nutrition-status-advice-button";
import { RecentMealsList } from "@/components/recent-meals-list";
import { NutritionDetailView } from "@/components/nutrition-detail-view";
import { useRegisterNutritionPageChrome } from "@/components/nutrition-page-chrome-context";
import { NutritionRemainingCard } from "@/components/nutrition-remaining-card";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import {
  estimateDailyMicros,
  getNutritionDayStatuses,
  isGoodNutritionHealthScore,
  scoreDailyNutrition,
  type NutritionDayContext,
} from "@/lib/nutrition-day-utils";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { MealLogPreviewDialog } from "@/components/meal-log-preview-dialog";
import { useMealsWithPhotoUrls } from "@/hooks/use-meals-with-photo-urls";
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  DashboardStatusIcon,
  dashboardCompletionStatus,
} from "@/components/section-completed-badge";
import { getPlannedMealSlots, isDayEnded } from "@/lib/meal-times";
import { patchOverviewDayCache } from "@/lib/dashboard-route-cache";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import type { DailyMealLog, Meal, MealSlot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DailyTrackerProps {
  clientId: string;
  date: Date;
  waterMl: number;
  dailyMeals: DailyMealLog[];
  onDailyMealsChange: (meals: DailyMealLog[]) => void;
  mealLibrary: PersonalMealLibraryItem[];
  hasAiAccess: boolean;
  targets: MacroTargets;
  onTargetsChange?: (targets: MacroTargets) => void;
  personalPlanId?: string | null;
  waterGoalMl: number;
  onWaterGoalChange?: (goal: number) => void;
  goal?: string | null;
  nutritionPlan?: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
    planId?: string;
  } | null;
  variant?: "full" | "compact";
  layout?: "card" | "detail";
  readOnly?: boolean;
}

export function DailyTracker({
  clientId,
  date,
  waterMl,
  dailyMeals,
  onDailyMealsChange,
  mealLibrary,
  hasAiAccess,
  targets,
  waterGoalMl,
  onWaterGoalChange,
  nutritionPlan,
  goal,
  variant = "full",
  layout = "card",
  readOnly = false,
}: DailyTrackerProps) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const locale = useLocale();
  const router = useRouter();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [previewMeal, setPreviewMeal] = useState<MealFormData | null>(null);
  const [previewMealLogId, setPreviewMealLogId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<"new" | "view">("new");
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [localWaterMl, setLocalWaterMl] = useState(waterMl);
  const { patchDashboard, notifySync } = useDashboardSync();
  const dateKey = formatDateKey(date);
  const mealsWithPhotos = useMealsWithPhotoUrls(clientId, dailyMeals);

  useEffect(() => {
    router.prefetch(DASHBOARD_DAY_NUTRITION_PATH);
  }, [router]);

  useEffect(() => {
    setLocalWaterMl(waterMl);
  }, [waterMl]);

  const applyMealsUpdate = (meals: DailyMealLog[]) => {
    onDailyMealsChange(meals);
    patchDashboard({ dateKey, dailyMeals: meals });
    patchOverviewDayCache(clientId, dateKey, { dailyMeals: meals });
    notifySync();
  };

  const current = useMemo(() => sumMealMacros(dailyMeals), [dailyMeals]);

  const plannedMealSlots = useMemo(() => {
    if (!nutritionPlan?.meals?.length) return [];
    return getPlannedMealSlots(
      nutritionPlan.meals,
      dailyMeals,
      dateKey,
      nutritionPlan.activeSlots
    );
  }, [nutritionPlan, dailyMeals, dateKey]);

  const hasMealPlan = plannedMealSlots.length > 0;
  const showMealPlanButton = hasMealPlan;

  const mealPlanSubtitle =
    nutritionPlan?.kind === "ai"
      ? platform.nutrition.aiCoachPlan
      : nutritionPlan
        ? platform.nutrition.yourMealPlan
        : undefined;

  const mealPlanEmptyMessage = !hasMealPlan
    ? platform.nutrition.mealPlanEmpty
    : undefined;

  const handleMealPlanClick = () => {
    setMealPlanOpen(true);
  };

  const waterMet = waterMetDailyMinimum(localWaterMl, waterGoalMl);
  const waterMissed =
    !waterMet && isDayEnded(dateKey);
  const waterCompleted = waterMet;
  const macrosMet = dailyMacrosWithinTarget(current, targets);
  const macrosExceeded = dailyMacrosExceededUpperLimit(current, targets);
  const macrosOverTarget = anyDailyMacroOverTarget(current, targets);
  const nutritionCompleted = macrosMet && waterCompleted && !macrosExceeded;
  const dailyMicros = useMemo(
    () => estimateDailyMicros(dailyMeals, current),
    [dailyMeals, current]
  );
  const healthScore = scoreDailyNutrition({
    current,
    targets,
    waterMl: localWaterMl,
    waterGoalMl,
    dateKey,
    mealCount: dailyMeals.length,
    micros: dailyMicros,
  }).score;
  const healthGood = isGoodNutritionHealthScore(healthScore);
  const nutritionChecked = nutritionCompleted || healthGood;
  const showNutritionStatus = nutritionChecked || macrosOverTarget || macrosExceeded;

  const nutritionTitle = isToday(date) ? platform.dashboard.nutrition : formatLocalized(date, "MMM d", locale);
  const mealPlanDialogTitle = isToday(date)
    ? platform.dashboard.todaysMealPlan
    : platform.dashboard.mealPlanOnDay(formatLocalized(date, "MMM d", locale));

  const handleAddWater = (amount: number) => {
    setLocalWaterMl((prev) => {
      const next = prev + amount;
      patchDashboard({ dateKey, waterMl: next });
      patchOverviewDayCache(clientId, dateKey, { waterMl: next });
      if (waterMetDailyMinimum(next, waterGoalMl)) {
        markReminderDone("water");
      }
      return next;
    });
    void addWater(clientId, dateKey, amount).catch(() => {
      setLocalWaterMl((prev) => {
        const reverted = prev - amount;
        patchDashboard({ dateKey, waterMl: reverted });
        patchOverviewDayCache(clientId, dateKey, { waterMl: reverted });
        return reverted;
      });
    });
  };

  const handleSetWaterGoal = async (nextGoal: number) => {
    const previous = waterGoalMl;
    onWaterGoalChange?.(nextGoal);
    const result = await updateWaterGoal(clientId, nextGoal);
    if ("error" in result && result.error) {
      onWaterGoalChange?.(previous);
      return { error: result.error };
    }
  };

  const handleDeleteMeal = (logId: string) => {
    const previous = dailyMeals;
    applyMealsUpdate(dailyMeals.filter((meal) => meal.id !== logId));
    return runServerAction(() => deleteDailyMealLog(clientId, dateKey, logId)).then(
      (result) => {
        if (isActionError(result) || ("error" in result && result.error)) {
          applyMealsUpdate(previous);
          return false;
        }
        return true;
      }
    );
  };

  const handleDeleteFromPreview = () => {
    if (!previewMealLogId || readOnly) return;
    setIsDeletingMeal(true);
    void handleDeleteMeal(previewMealLogId).then((ok) => {
      setIsDeletingMeal(false);
      if (ok) {
        setPreviewOpen(false);
        setPreviewMealLogId(null);
        setPreviewPhotoUrl(null);
      }
    });
  };

  const handleUpdateMeal = (form: MealFormData) => {
    if (!previewMealLogId || readOnly || isSavingMeal) return;
    setIsSavingMeal(true);
    void runServerAction(() =>
      updateDailyMealLog(clientId, dateKey, previewMealLogId, form)
    ).then((result) => {
      setIsSavingMeal(false);
      if (isActionError(result) || ("error" in result && result.error)) return;
      refreshMeals();
      setPreviewOpen(false);
      setPreviewMealLogId(null);
      setPreviewPhotoUrl(null);
    });
  };

  const aiMealsUsed = dailyMeals.filter((meal) => meal.ai_assisted).length;

  const refreshMeals = () => {
    void runServerAction(() =>
      import("@/lib/actions/daily-meals").then(({ getDailyMealLogs }) =>
        getDailyMealLogs(clientId, dateKey)
      )
    ).then((result) => {
      if (isActionError(result)) return;
      if (Array.isArray(result)) applyMealsUpdate(result);
    });
  };

  const handleLogged = (_preview?: MealFormData) => {
    // Log directly — skip the "Meal logged" summary drawer.
    refreshMeals();
  };

  const handleSelectMeal = (meal: DailyMealLog) => {
    setPreviewVariant("view");
    setPreviewMeal(mealFormFromMeal(meal));
    setPreviewMealLogId(meal.id);
    setPreviewPhotoUrl(meal.photo_url ?? null);
    setPreviewOpen(true);
  };

  const nutritionContext = useMemo<NutritionDayContext>(
    () => ({
      current,
      targets,
      waterMl: localWaterMl,
      waterGoalMl,
      dateKey,
      mealCount: dailyMeals.length,
    }),
    [current, targets, localWaterMl, waterGoalMl, dateKey, dailyMeals.length]
  );
  const nutritionStatuses = useMemo(
    () => getNutritionDayStatuses(nutritionContext, dailyMicros),
    [nutritionContext, dailyMicros]
  );
  const isDetailLayout = layout === "detail";

  const nutritionChromeActions = useMemo(() => {
    if (!isDetailLayout) return null;

    const headerTrailing =
      nutritionStatuses.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {nutritionStatuses.map((status) => (
            <NutritionStatusAdviceButton
              key={status}
              status={status}
              context={nutritionContext}
              meals={dailyMeals}
              micros={dailyMicros}
            />
          ))}
        </div>
      ) : null;

    if (!readOnly) {
      return {
        onLogMeal: () => setLogMealOpen(true),
        onDietPlan: handleMealPlanClick,
        showDietPlan: showMealPlanButton,
        headerTrailing,
      };
    }

    return {
      onDietPlan: handleMealPlanClick,
      showDietPlan: showMealPlanButton,
      headerTrailing,
    };
  }, [
    isDetailLayout,
    readOnly,
    showMealPlanButton,
    nutritionStatuses,
    nutritionContext,
    dailyMeals,
    dailyMicros,
  ]);
  useRegisterNutritionPageChrome(nutritionChromeActions);

  const nutritionDialogs = (
    <>
      <MealPlanDialog
        open={mealPlanOpen}
        onClose={() => setMealPlanOpen(false)}
        title={mealPlanDialogTitle}
        subtitle={mealPlanSubtitle}
        slots={plannedMealSlots}
        emptyMessage={mealPlanEmptyMessage}
        clientId={clientId}
        planId={nutritionPlan?.planId ?? null}
      />

      <LogMealDialog
        open={logMealOpen}
        clientId={clientId}
        dateKey={dateKey}
        library={mealLibrary}
        hasAiAccess={hasAiAccess}
        aiMealsUsed={aiMealsUsed}
        onClose={() => setLogMealOpen(false)}
        onLogged={handleLogged}
        goal={goal}
      />

      <MealLogPreviewDialog
        open={previewOpen}
        meal={previewMeal}
        photoUrl={previewPhotoUrl}
        targets={targets}
        goal={goal}
        variant={previewVariant}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewPhotoUrl(null);
          setPreviewMealLogId(null);
        }}
        onDelete={previewVariant === "view" && !readOnly ? handleDeleteFromPreview : undefined}
        onUpdate={previewVariant === "view" && !readOnly ? handleUpdateMeal : undefined}
        isDeleting={isDeletingMeal}
        isSaving={isSavingMeal}
      />
    </>
  );

  if (variant === "compact") {
    const nutritionStatus = dashboardCompletionStatus(
      nutritionChecked,
      isDayEnded(dateKey)
    );
    return (
      <>
      <DashboardThemedShell
        id="dashboard-nutrition"
        theme="nutrition"
        solid
        className="relative w-full cursor-pointer transition-opacity hover:opacity-95 active:opacity-90"
      >
        <DashboardCardNavLink
          href={DASHBOARD_DAY_NUTRITION_PATH}
          ariaLabel={nutritionTitle}
        />
        <DashboardCardNavBody className="flex flex-col">
          <NutritionRemainingCard
            current={current}
            targets={targets}
            onLogMeal={readOnly ? undefined : () => setLogMealOpen(true)}
            status={nutritionStatus}
            statusLabel={
              nutritionStatus === "completed"
                ? platform.aria.completed
                : nutritionStatus === "missed"
                  ? platform.common.incomplete
                  : platform.common.inProgress
            }
          />
        </DashboardCardNavBody>
      </DashboardThemedShell>
        {nutritionDialogs}
      </>
    );
  }

  if (isDetailLayout) {
    return (
      <>
        <div id="dashboard-nutrition" className="space-y-3">
          <NutritionDetailView
            current={current}
            targets={targets}
            micros={dailyMicros}
            context={nutritionContext}
            meals={dailyMeals}
            waterMl={localWaterMl}
            waterGoalMl={waterGoalMl}
          />

          <div className="hidden items-center justify-end gap-2 lg:flex">
            {!readOnly ? (
              <>
                <Button
                  size="sm"
                  className="h-9 rounded-full px-4"
                  onClick={() => setLogMealOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                  {platform.nutrition.logMeal}
                </Button>
                {showMealPlanButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full px-4"
                    onClick={handleMealPlanClick}
                  >
                    <ClipboardList className="h-4 w-4" />
                    {platform.nutrition.viewDietPlan}
                  </Button>
                )}
              </>
            ) : showMealPlanButton ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-full px-4"
                onClick={handleMealPlanClick}
              >
                <ClipboardList className="h-4 w-4" />
                {platform.nutrition.viewDietPlan}
              </Button>
            ) : null}
          </div>

          <RecentMealsList
            meals={mealsWithPhotos}
            onSelect={handleSelectMeal}
            onAdd={readOnly ? undefined : () => setLogMealOpen(true)}
            showHeaderAdd={false}
            title={platform.nutrition.mealsLogged}
            emptyHint={platform.nutrition.logFirstMealHint}
            variant="feed"
            collapsible={false}
            headingClassName="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          />
        </div>
        {nutritionDialogs}
      </>
    );
  }

  return (
    <>
      <Card id="dashboard-nutrition" className="relative">
        {showNutritionStatus && (
          <div className="absolute right-3 top-3 z-10">
            {nutritionChecked ? (
              <DashboardStatusIcon status="completed" aria-label="Completed" />
            ) : (
              <DashboardStatusIcon status="missed" aria-label="Over limit" />
            )}
          </div>
        )}
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Apple className="h-5 w-5 text-primary" />
              <span
                className={cn(nutritionChecked && "text-muted-foreground line-through")}
              >
                {nutritionTitle}
              </span>
              <MissedButton
                count={macrosOverTarget || macrosExceeded ? 1 : 0}
                title={coachLabels.exceededTasks}
                hint={coachLabels.macrosExceededHint}
                buttonLabel={coachLabels.exceeded}
                tone="missed"
                items={
                  macrosOverTarget || macrosExceeded
                    ? [
                        {
                          id: "macros-over",
                          label: "Daily macros over limit",
                          detail: formatExceededMacroSummary(current, targets),
                        },
                      ]
                    : []
                }
              />
              <MissedButton
                count={waterMissed ? 1 : 0}
                title={coachLabels.hydrationFail}
                hint={coachLabels.hydrationHint}
                items={
                  waterMissed
                    ? [
                        {
                          id: "water",
                          label: platform.nutrition.drinkWater(waterGoalMl),
                          detail: platform.nutrition.waterLogged(
                            localWaterMl,
                            waterGoalMl
                          ),
                        },
                      ]
                    : []
                }
              />
            </CardTitle>
            {nutritionPlan && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {nutritionPlan.title}
                {nutritionPlan.scheduled
                  ? ` · ${platform.common.scheduled}`
                  : ` · ${mealPlanSubtitle ?? platform.common.active}`}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showMealPlanButton && (
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full"
                onClick={handleMealPlanClick}
                aria-label={platform.aria.viewMealPlan}
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
            )}
            {!readOnly ? (
              <Button
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setLogMealOpen(true)}
                aria-label={platform.aria.logMeal}
              >
                <Camera className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <NutritionStatsPanel
            current={current}
            targets={targets}
            waterMl={localWaterMl}
            waterGoalMl={waterGoalMl}
            onAddWater={readOnly ? undefined : handleAddWater}
            onSetWaterGoal={readOnly || !onWaterGoalChange ? undefined : handleSetWaterGoal}
          />

          <RecentMealsList
            title={platform.nutrition.mealsLogged}
            meals={mealsWithPhotos}
            onSelect={handleSelectMeal}
            onAdd={readOnly ? undefined : () => setLogMealOpen(true)}
            showHeaderAdd={false}
            emptyHint={platform.nutrition.logFirstMealHint}
          />
        </CardContent>
      </Card>

      {nutritionDialogs}
    </>
  );
}
