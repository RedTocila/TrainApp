"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { Apple, Camera, ChevronRight, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
} from "@/components/dashboard-card-nav-link";
import { formatDateKey } from "@/lib/utils";
import { DASHBOARD_DAY_NUTRITION_PATH } from "@/lib/dashboard-day-routes";
import { addWater, updateWaterGoal } from "@/lib/actions/logs";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
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
import type { MacroTargets } from "@/lib/meal-score";
import { NutritionStatsPanel } from "@/components/nutrition-stats-panel";
import { NutritionStatusAdviceButton } from "@/components/nutrition-status-advice-button";
import { RecentMealsList } from "@/components/recent-meals-list";
import { NutritionDetailView } from "@/components/nutrition-detail-view";
import { useRegisterNutritionPageChrome } from "@/components/nutrition-page-chrome-context";
import { TaskNutritionMacroPreview } from "@/components/task-nutrition-macro-preview";
import {
  estimateDailyMicros,
  getNutritionDayStatuses,
  type NutritionDayContext,
} from "@/lib/nutrition-day-utils";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { NutritionPlanPdfDialog } from "@/components/nutrition-plan-pdf-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { MealLogPreviewDialog } from "@/components/meal-log-preview-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  DashboardStatusIcon,
} from "@/components/section-completed-badge";
import { getPlannedMealSlots, isDeadlinePassed, WATER_DEADLINE } from "@/lib/meal-times";
import type { CoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
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
  } | null;
  coachNutritionPlanState: CoachNutritionPlanViewState;
  variant?: "full" | "compact";
  layout?: "card" | "detail";
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
  coachNutritionPlanState,
  goal,
  variant = "full",
  layout = "card",
}: DailyTrackerProps) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [pdfPlanOpen, setPdfPlanOpen] = useState(false);
  const [previewMeal, setPreviewMeal] = useState<MealFormData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<"new" | "view">("new");
  const [localWaterMl, setLocalWaterMl] = useState(waterMl);
  const { patchDashboard } = useDashboardSync();
  const dateKey = formatDateKey(date);

  useEffect(() => {
    router.prefetch(DASHBOARD_DAY_NUTRITION_PATH);
  }, [router]);

  useEffect(() => {
    setLocalWaterMl(waterMl);
  }, [waterMl]);

  useEffect(() => {
    patchDashboard({ dateKey, dailyMeals });
  }, [dateKey, dailyMeals, patchDashboard]);

  const current = sumMealMacros(dailyMeals);

  const awaitingCoachPdf = coachNutritionPlanState.mode === "awaiting_pdf";
  const coachPdfRequestId =
    coachNutritionPlanState.mode === "pdf" ? coachNutritionPlanState.requestId : null;

  const plannedMealSlots = useMemo(() => {
    if (!nutritionPlan?.meals?.length) return [];
    return getPlannedMealSlots(
      nutritionPlan.meals,
      dailyMeals,
      dateKey,
      nutritionPlan.activeSlots
    );
  }, [nutritionPlan?.meals, nutritionPlan?.activeSlots, dailyMeals, dateKey]);

  const hasMealPlan = plannedMealSlots.length > 0;
  const showMealPlanButton = hasMealPlan || awaitingCoachPdf || !!coachPdfRequestId;

  const mealPlanSubtitle =
    nutritionPlan?.kind === "ai"
      ? platform.nutrition.aiCoachPlan
      : nutritionPlan
        ? platform.nutrition.yourMealPlan
        : undefined;

  const mealPlanEmptyMessage = !hasMealPlan
    ? awaitingCoachPdf
      ? platform.nutrition.coachPdfEmpty
      : platform.nutrition.mealPlanEmpty
    : undefined;

  const handleMealPlanClick = () => {
    if (hasMealPlan || awaitingCoachPdf || !coachPdfRequestId) {
      setMealPlanOpen(true);
      return;
    }
    setPdfPlanOpen(true);
  };

  const waterMissed =
    localWaterMl < waterGoalMl && isDeadlinePassed(WATER_DEADLINE, dateKey);
  const waterCompleted = localWaterMl >= waterGoalMl;
  const macrosMet = dailyMacrosWithinTarget(current, targets);
  const macrosExceeded = dailyMacrosExceededUpperLimit(current, targets);
  const macrosOverTarget = anyDailyMacroOverTarget(current, targets);
  const nutritionCompleted = macrosMet && waterCompleted && !macrosExceeded;
  const showNutritionStatus = nutritionCompleted || macrosOverTarget;

  const nutritionTitle = isToday(date) ? platform.dashboard.nutrition : format(date, "MMM d");
  const mealPlanDialogTitle = isToday(date)
    ? platform.dashboard.todaysMealPlan
    : platform.dashboard.mealPlanOnDay(format(date, "MMM d"));

  const handleAddWater = (amount: number) => {
    setLocalWaterMl((prev) => {
      const next = prev + amount;
      patchDashboard({ dateKey, waterMl: next });
      return next;
    });
    void addWater(clientId, dateKey, amount).catch(() => {
      setLocalWaterMl((prev) => {
        const reverted = prev - amount;
        patchDashboard({ dateKey, waterMl: reverted });
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
    onDailyMealsChange(dailyMeals.filter((meal) => meal.id !== logId));
    void runServerAction(() => deleteDailyMealLog(clientId, dateKey, logId)).then(
      (result) => {
        if (isActionError(result) || ("error" in result && result.error)) {
          onDailyMealsChange(previous);
        }
      }
    );
  };

  const refreshMeals = () => {
    void runServerAction(() =>
      import("@/lib/actions/daily-meals").then(({ getDailyMealLogs }) =>
        getDailyMealLogs(clientId, dateKey)
      )
    ).then((result) => {
      if (isActionError(result)) return;
      if (Array.isArray(result)) onDailyMealsChange(result);
    });
  };

  const handleLogged = (preview?: MealFormData) => {
    refreshMeals();
    if (!preview) return;
    try {
      setPreviewVariant("new");
      setPreviewMeal(preview);
      setPreviewOpen(true);
    } catch {
      setPreviewOpen(false);
    }
  };

  const handleSelectMeal = (meal: DailyMealLog) => {
    setPreviewVariant("view");
    setPreviewMeal(mealFormFromMeal(meal));
    setPreviewOpen(true);
  };

  const nutritionContext: NutritionDayContext = {
    current,
    targets,
    waterMl: localWaterMl,
    waterGoalMl,
    dateKey,
    mealCount: dailyMeals.length,
  };
  const nutritionStatuses = getNutritionDayStatuses(nutritionContext);
  const isDetailLayout = layout === "detail";
  const dailyMicros = estimateDailyMicros(dailyMeals, current);

  const nutritionChromeActions = useMemo(
    () =>
      isDetailLayout
        ? {
            onLogMeal: () => setLogMealOpen(true),
            onDietPlan: handleMealPlanClick,
            showDietPlan: showMealPlanButton,
            status: nutritionCompleted
              ? ("completed" as const)
              : macrosOverTarget
                ? ("over" as const)
                : null,
          }
        : null,
    [isDetailLayout, showMealPlanButton, nutritionCompleted, macrosOverTarget]
  );
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
        coachPdfRequestId={coachPdfRequestId}
        onOpenCoachPdf={() => {
          setMealPlanOpen(false);
          setPdfPlanOpen(true);
        }}
      />

      {coachPdfRequestId && (
        <NutritionPlanPdfDialog
          open={pdfPlanOpen}
          onClose={() => setPdfPlanOpen(false)}
          title={mealPlanDialogTitle}
          requestId={coachPdfRequestId}
        />
      )}

      <LogMealDialog
        open={logMealOpen}
        clientId={clientId}
        dateKey={dateKey}
        library={mealLibrary}
        hasAiAccess={hasAiAccess}
        onClose={() => setLogMealOpen(false)}
        onLogged={handleLogged}
        goal={goal}
      />

      <MealLogPreviewDialog
        open={previewOpen}
        meal={previewMeal}
        targets={targets}
        goal={goal}
        variant={previewVariant}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );

  if (variant === "compact") {
    return (
      <>
      <Card
        id="dashboard-nutrition"
        className="relative flex h-full w-full cursor-pointer flex-col transition-opacity hover:opacity-95 active:opacity-90"
      >
        <DashboardCardNavLink
          href={DASHBOARD_DAY_NUTRITION_PATH}
          ariaLabel={nutritionTitle}
        />
        <DashboardCardNavBody className="flex flex-1 flex-col">
          {showNutritionStatus && (
            <div className="absolute right-3 top-3 z-10">
              {nutritionCompleted && !macrosOverTarget ? (
                <DashboardStatusIcon status="completed" aria-label="Completed" />
              ) : (
                <DashboardStatusIcon status="missed" aria-label="Over limit" />
              )}
            </div>
          )}
          <CardHeader className="space-y-2 p-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg font-black">
                    <Apple className="h-5 w-5 text-primary" />
                    <span
                      className={cn(nutritionCompleted && "text-muted-foreground line-through")}
                    >
                      {nutritionTitle}
                    </span>
                  </CardTitle>
                  {nutritionStatuses.map((status) => (
                    <NutritionStatusAdviceButton
                      key={status}
                      status={status}
                      context={nutritionContext}
                    />
                  ))}
                </div>
                <p className="mt-1 text-sm font-medium tabular-nums">
                  {current.calories}/{targets.calories} kcal
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {platform.nutrition.mealsLogged}: {dailyMeals.length}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-4 pt-0">
            <TaskNutritionMacroPreview current={current} targets={targets} />
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => setLogMealOpen(true)}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {platform.nutrition.logMeal}
                </Button>
                {showMealPlanButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full px-3"
                    onClick={handleMealPlanClick}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {platform.nutrition.viewDietPlan}
                  </Button>
                )}
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
          </CardContent>
        </DashboardCardNavBody>
      </Card>
        {nutritionDialogs}
      </>
    );
  }

  if (isDetailLayout) {
    return (
      <>
        <div id="dashboard-nutrition" className="space-y-4">
          {showNutritionStatus ? (
            <div className="hidden justify-end lg:flex">
              {nutritionCompleted && !macrosOverTarget ? (
                <DashboardStatusIcon status="completed" aria-label="Completed" />
              ) : (
                <DashboardStatusIcon status="missed" aria-label="Over limit" />
              )}
            </div>
          ) : null}

          <div className="hidden items-center justify-end gap-2 lg:flex">
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
          </div>

          {nutritionStatuses.length > 0 && (
            <div className="space-y-2">
              {nutritionStatuses.map((status) => (
                <NutritionStatusAdviceButton
                  key={status}
                  status={status}
                  context={nutritionContext}
                  variant="banner"
                />
              ))}
            </div>
          )}

          <NutritionDetailView
            current={current}
            targets={targets}
            micros={dailyMicros}
            context={nutritionContext}
          />

          <RecentMealsList
            meals={dailyMeals}
            onDelete={handleDeleteMeal}
            onSelect={handleSelectMeal}
            onAdd={() => setLogMealOpen(true)}
            showHeaderAdd={false}
            emptyHint={platform.nutrition.logFirstMealHint}
            variant="feed"
            collapsible={false}
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
            {nutritionCompleted && !macrosOverTarget ? (
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
                className={cn(nutritionCompleted && "text-muted-foreground line-through")}
              >
                {nutritionTitle}
              </span>
              <MissedButton
                count={macrosExceeded ? 1 : 0}
                title={coachLabels.exceededTasks}
                hint={coachLabels.macrosExceededHint}
                buttonLabel={coachLabels.exceeded}
                tone="missed"
                items={
                  macrosExceeded
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
                            waterGoalMl,
                            WATER_DEADLINE
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
            {!nutritionPlan && awaitingCoachPdf && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {platform.nutrition.coachPdfPending}
              </p>
            )}
            {!nutritionPlan && !awaitingCoachPdf && coachPdfRequestId && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {platform.nutrition.coachNutritionPdf}
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
            <Button
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setLogMealOpen(true)}
              aria-label={platform.aria.logMeal}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <NutritionStatsPanel
            current={current}
            targets={targets}
            waterMl={localWaterMl}
            waterGoalMl={waterGoalMl}
            onAddWater={handleAddWater}
            onSetWaterGoal={onWaterGoalChange ? handleSetWaterGoal : undefined}
          />

          <RecentMealsList
            title={platform.nutrition.mealsLogged}
            meals={dailyMeals}
            onDelete={handleDeleteMeal}
            onSelect={handleSelectMeal}
            onAdd={() => setLogMealOpen(true)}
            showHeaderAdd={false}
            emptyHint={platform.nutrition.logFirstMealHint}
          />
        </CardContent>
      </Card>

      {nutritionDialogs}
    </>
  );
}
