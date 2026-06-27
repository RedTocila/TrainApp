"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { Apple, ClipboardList, Plus } from "lucide-react";
import { formatDateKey } from "@/lib/utils";
import { addWater } from "@/lib/actions/logs";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { MealFormData } from "@/lib/meal-utils";
import { sumMealMacros, mealFormFromMeal } from "@/lib/meal-utils";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import {
  dailyMacrosExceededUpperLimit,
  dailyMacrosWithinTarget,
  formatExceededMacroSummary,
} from "@/lib/macro-targets";
import type { MacroTargets } from "@/lib/meal-score";
import { NutritionStatsPanel } from "@/components/nutrition-stats-panel";
import { RecentMealsList } from "@/components/recent-meals-list";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { NutritionPlanPdfDialog } from "@/components/nutrition-plan-pdf-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { MealLogPreviewDialog } from "@/components/meal-log-preview-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
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
  nutritionPlan,
  coachNutritionPlanState,
  goal,
}: DailyTrackerProps) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
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
  const nutritionCompleted = macrosMet && waterCompleted && !macrosExceeded;

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
    try {
      setPreviewVariant("view");
      setPreviewMeal(mealFormFromMeal(meal));
      setPreviewOpen(true);
    } catch {
      setPreviewOpen(false);
    }
  };

  return (
    <>
      <Card
        id="dashboard-nutrition"
        className={cn(sectionCompletedCardClass(nutritionCompleted))}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Apple className="h-5 w-5 text-primary" />
              {nutritionTitle}
              {nutritionCompleted && <SectionCompletedBadge />}
              <MissedButton
                count={macrosExceeded ? 1 : 0}
                title={coachLabels.exceededTasks}
                hint={coachLabels.macrosExceededHint}
                buttonLabel={coachLabels.exceeded}
                tone="warning"
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
              <Plus className="h-4 w-4" />
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
}
