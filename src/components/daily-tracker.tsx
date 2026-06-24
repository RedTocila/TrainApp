"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isToday } from "date-fns";
import { Apple, Check, ClipboardList, Plus } from "lucide-react";
import { formatDateKey } from "@/lib/utils";
import { addWater } from "@/lib/actions/logs";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import { sumMealMacros } from "@/lib/meal-utils";
import { NutritionStatsPanel } from "@/components/nutrition-stats-panel";
import { RecentMealsList } from "@/components/recent-meals-list";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { useDashboardSync } from "@/components/dashboard-sync";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
import {
  countMissedMealSlots,
  getPlannedMealSlots,
  isDeadlinePassed,
  WATER_DEADLINE,
} from "@/lib/meal-times";
import type { DailyMealLog, Meal, MealSlot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

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
  nutritionPlan?: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
  } | null;
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
}: DailyTrackerProps) {
  const [isPending, startTransition] = useTransition();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [localWaterMl, setLocalWaterMl] = useState(waterMl);
  const [mealTick, setMealTick] = useState(0);
  const { patchDashboard, notifySync } = useDashboardSync();
  const dateKey = formatDateKey(date);

  useEffect(() => {
    if (!isToday(date)) return;
    const id = setInterval(() => setMealTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [date]);

  useEffect(() => {
    setLocalWaterMl(waterMl);
  }, [waterMl]);

  const current = sumMealMacros(dailyMeals);

  const plannedMealSlots = useMemo(
    () =>
      nutritionPlan?.meals?.length
        ? getPlannedMealSlots(
            nutritionPlan.meals,
            dailyMeals,
            dateKey,
            nutritionPlan.activeSlots
          )
        : [],
    [nutritionPlan?.meals, nutritionPlan?.activeSlots, dailyMeals, dateKey, mealTick]
  );

  const hasMealPlan = plannedMealSlots.length > 0;

  const missedMeals = countMissedMealSlots(plannedMealSlots);
  const missedMealItems = useMemo(
    () =>
      plannedMealSlots
        .filter((s) => s.status === "missed" && s.meal)
        .map((s) => ({
          id: s.slot,
          label: `${s.label}: ${s.meal!.name}`,
          detail: `Was due ${s.timeWindow}`,
        })),
    [plannedMealSlots]
  );
  const waterMissed =
    localWaterMl < waterGoalMl && isDeadlinePassed(WATER_DEADLINE, dateKey);
  const waterCompleted = localWaterMl >= waterGoalMl;
  const nutritionCompleted =
    current.calories >= targets.calories &&
    current.protein >= targets.protein &&
    waterCompleted;

  const nutritionTitle = isToday(date) ? "Nutrition" : format(date, "MMM d");
  const mealPlanDialogTitle = isToday(date)
    ? "Today's meal plan"
    : `Meal plan · ${format(date, "MMM d")}`;

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

  return (
    <>
      <Card
        id="dashboard-nutrition"
        className={cn(sectionCompletedCardClass(nutritionCompleted && hasMealPlan))}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Apple className="h-5 w-5 text-primary" />
              {nutritionTitle}
              {nutritionCompleted && hasMealPlan && <SectionCompletedBadge />}
              <MissedButton
                count={missedMeals + (waterMissed ? 1 : 0)}
                title="Missed today"
                hint="Try to stay on schedule with meals and water."
                items={[
                  ...missedMealItems,
                  ...(waterMissed
                    ? [
                        {
                          id: "water",
                          label: `Drink ${waterGoalMl.toLocaleString()} ml`,
                          detail: `${localWaterMl.toLocaleString()} ml logged · goal by ${WATER_DEADLINE}`,
                        },
                      ]
                    : []),
                ]}
              />
            </CardTitle>
            {nutritionPlan && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {nutritionPlan.title}
                {nutritionPlan.scheduled && " · scheduled"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasMealPlan && (
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full"
                onClick={() => setMealPlanOpen(true)}
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
        slots={plannedMealSlots}
      />

      <LogMealDialog
        open={logMealOpen}
        clientId={clientId}
        dateKey={dateKey}
        library={mealLibrary}
        hasAiAccess={hasAiAccess}
        onClose={() => setLogMealOpen(false)}
        onLogged={refreshMeals}
      />
    </>
  );
}
