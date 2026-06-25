"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isToday } from "date-fns";
import { Apple, Check, ClipboardList, Plus } from "lucide-react";
import { formatDateKey } from "@/lib/utils";
import { addWater } from "@/lib/actions/logs";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import { sumMealMacros, mealFormFromMeal } from "@/lib/meal-utils";
import type { MealFormData } from "@/lib/meal-utils";
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
  const [isPending, startTransition] = useTransition();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [pdfPlanOpen, setPdfPlanOpen] = useState(false);
  const [previewMeal, setPreviewMeal] = useState<MealFormData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<"new" | "view">("new");
  const [localWaterMl, setLocalWaterMl] = useState(waterMl);
  const { patchDashboard, notifySync } = useDashboardSync();
  const dateKey = formatDateKey(date);

  useEffect(() => {
    setLocalWaterMl(waterMl);
  }, [waterMl]);

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

  const mealPlanSubtitle = nutritionPlan?.kind === "ai" ? "AI Coach plan" : nutritionPlan ? "Your meal plan" : undefined;

  const mealPlanEmptyMessage = !hasMealPlan
    ? awaitingCoachPdf
      ? "Your coach PDF plan is still being prepared. Create or activate a personal or AI meal plan under Programs → Nutrition, or log meals with +."
      : "No meal plan for this day yet. Build one in Programs → Nutrition or with AI Coach."
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
  const macrosMet =
    current.calories >= targets.calories &&
    current.protein >= targets.protein &&
    current.carbs >= targets.carbs &&
    current.fat >= targets.fat;
  const nutritionCompleted = macrosMet && waterCompleted;

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
    notifySync();
    startTransition(() => {
      void addWater(clientId, dateKey, amount).catch(() => {
        setLocalWaterMl((prev) => {
          const reverted = prev - amount;
          patchDashboard({ dateKey, waterMl: reverted });
          return reverted;
        });
      });
    });
  };

  const handleDeleteMeal = (logId: string) => {
    const previous = dailyMeals;
    onDailyMealsChange(dailyMeals.filter((meal) => meal.id !== logId));
    notifySync();
    startTransition(async () => {
      const result = await deleteDailyMealLog(clientId, dateKey, logId);
      if (result.error) {
        onDailyMealsChange(previous);
      }
    });
  };

  const refreshMeals = () => {
    notifySync();
    startTransition(async () => {
      const { getDailyMealLogs } = await import("@/lib/actions/daily-meals");
      const meals = await getDailyMealLogs(clientId, dateKey);
      onDailyMealsChange(meals);
    });
  };

  const handleLogged = (preview?: MealFormData) => {
    refreshMeals();
    if (preview) {
      setPreviewVariant("new");
      setPreviewMeal(preview);
      setPreviewOpen(true);
    }
  };

  const handleSelectMeal = (meal: DailyMealLog) => {
    setPreviewVariant("view");
    setPreviewMeal(mealFormFromMeal(meal));
    setPreviewOpen(true);
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
                count={waterMissed ? 1 : 0}
                title="Hydration fail"
                hint="Tomorrow: drink water like Coach Alex's not watching. He is."
                items={
                  waterMissed
                    ? [
                        {
                          id: "water",
                          label: `Drink ${waterGoalMl.toLocaleString()} ml`,
                          detail: `${localWaterMl.toLocaleString()} ml logged · goal by ${WATER_DEADLINE}`,
                        },
                      ]
                    : []
                }
              />
            </CardTitle>
            {nutritionPlan && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {nutritionPlan.title}
                {nutritionPlan.scheduled ? " · scheduled" : ` · ${mealPlanSubtitle ?? "active"}`}
              </p>
            )}
            {!nutritionPlan && awaitingCoachPdf && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Coach PDF plan · pending
              </p>
            )}
            {!nutritionPlan && !awaitingCoachPdf && coachPdfRequestId && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Coach nutrition plan · PDF
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
                aria-label="View meal plan"
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setLogMealOpen(true)}
              aria-label="Log meal"
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
            waterLoading={isPending}
          />

          {waterCompleted && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400">
              <Check className="h-4 w-4" />
              Water goal reached
            </div>
          )}

          <RecentMealsList
            title="Meals logged"
            meals={dailyMeals}
            onDelete={handleDeleteMeal}
            onSelect={handleSelectMeal}
            onAdd={() => setLogMealOpen(true)}
            isPending={isPending}
            showHeaderAdd={false}
            emptyHint="Tap + to log your first meal"
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
