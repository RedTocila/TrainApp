"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isToday } from "date-fns";
import { Apple, Check, Plus, Trash2 } from "lucide-react";
import { formatDateKey } from "@/lib/utils";
import {
  addWater,
  updateNutritionTargets,
  updateWaterGoal,
} from "@/lib/actions/logs";
import { deleteDailyMealLog } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import {
  formatMealMacrosSummary,
  normalizeMealMacros,
  sumMealMacros,
} from "@/lib/meal-utils";
import { WaterRing } from "@/components/water-ring";
import { MacroBars } from "@/components/macro-bars";
import { MealPlanChecklist } from "@/components/scheduled-meals-list";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const WATER_GOAL_PRESETS = [2000, 2500, 3000, 3500];

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

function GoalToggle({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {open ? "Hide goal settings" : label}
    </button>
  );
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
  onTargetsChange,
  personalPlanId,
  waterGoalMl,
  onWaterGoalChange,
  nutritionPlan,
}: DailyTrackerProps) {
  const [isPending, startTransition] = useTransition();
  const [waterGoalOpen, setWaterGoalOpen] = useState(false);
  const [nutritionGoalOpen, setNutritionGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState(String(waterGoalMl));
  const [goalError, setGoalError] = useState<string | null>(null);
  const [nutritionGoalError, setNutritionGoalError] = useState<string | null>(null);
  const [nutritionGoalInput, setNutritionGoalInput] = useState(targets);
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [localWaterMl, setLocalWaterMl] = useState(waterMl);
  const [mealTick, setMealTick] = useState(0);
  const { notifySync } = useDashboardSync();
  const dateKey = formatDateKey(date);

  useEffect(() => {
    if (!isToday(date)) return;
    const id = setInterval(() => setMealTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [date]);

  useEffect(() => {
    setLocalWaterMl(waterMl);
  }, [waterMl]);

  useEffect(() => {
    setGoalInput(String(waterGoalMl));
  }, [waterGoalMl]);

  useEffect(() => {
    setNutritionGoalInput(targets);
  }, [targets]);

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

  const extraLoggedMeals = useMemo(
    () => dailyMeals.filter((meal) => !meal.slot),
    [dailyMeals]
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
    localWaterMl < waterGoalMl &&
    isDeadlinePassed(WATER_DEADLINE, dateKey);
  const waterCompleted = localWaterMl >= waterGoalMl;

  const nutritionTitle = isToday(date) ? "Nutrition Today" : `Nutrition · ${format(date, "MMM d")}`;

  const handleAddWater = (amount: number) => {
    setLocalWaterMl((prev) => prev + amount);
    startTransition(() => {
      void addWater(clientId, dateKey, amount).then(() => notifySync());
    });
  };

  const handleDeleteMeal = (logId: string) => {
    startTransition(async () => {
      const result = await deleteDailyMealLog(clientId, dateKey, logId);
      if (result.error) return;
      onDailyMealsChange(dailyMeals.filter((meal) => meal.id !== logId));
      notifySync();
    });
  };

  const saveWaterGoal = (ml: number) => {
    setGoalError(null);
    startTransition(async () => {
      const result = await updateWaterGoal(clientId, ml);
      if (result.error) {
        setGoalError(result.error);
        return;
      }
      setGoalInput(String(ml));
      onWaterGoalChange?.(ml);
      setWaterGoalOpen(false);
    });
  };

  const handleSaveWaterGoal = () => {
    const parsed = parseInt(goalInput, 10);
    if (!Number.isFinite(parsed)) {
      setGoalError("Enter a valid number");
      return;
    }
    saveWaterGoal(parsed);
  };

  const handleSaveNutritionGoal = () => {
    setNutritionGoalError(null);
    startTransition(async () => {
      const result = await updateNutritionTargets(clientId, nutritionGoalInput, {
        personalPlanId,
      });
      if (result.error) {
        setNutritionGoalError(result.error);
        return;
      }
      onTargetsChange?.(nutritionGoalInput);
      setNutritionGoalOpen(false);
    });
  };

  const refreshMeals = () => {
    startTransition(async () => {
      const { getDailyMealLogs } = await import("@/lib/actions/daily-meals");
      const meals = await getDailyMealLogs(clientId, dateKey);
      onDailyMealsChange(meals);
      notifySync();
    });
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card id="dashboard-nutrition">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Apple className="h-5 w-5 text-primary" />
                {nutritionTitle}
                <MissedButton
                  count={missedMeals}
                  title="Missed meals"
                  hint="Try to eat on schedule next time."
                  items={missedMealItems}
                />
              </CardTitle>
              {nutritionPlan ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {nutritionPlan.title}
                  {nutritionPlan.scheduled && " · scheduled for this day"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No nutrition plan assigned yet
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                Goal: {targets.calories} cal · {targets.protein}g protein · {targets.carbs}g carbs ·{" "}
                {targets.fat}g fat
              </p>
              <div className="mt-2">
                <GoalToggle
                  label="Change nutrition goal"
                  open={nutritionGoalOpen}
                  onToggle={() => {
                    setNutritionGoalError(null);
                    setNutritionGoalOpen((open) => !open);
                  }}
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => setLogMealOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Log meal
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {nutritionGoalOpen && (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
                <Label className="text-sm font-medium">Daily nutrition goal</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["calories", "Calories"],
                      ["protein", "Protein (g)"],
                      ["carbs", "Carbs (g)"],
                      ["fat", "Fat (g)"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label htmlFor={`nutrition-goal-${field}`}>{label}</Label>
                      <Input
                        id={`nutrition-goal-${field}`}
                        type="number"
                        min={0}
                        value={nutritionGoalInput[field]}
                        onChange={(e) =>
                          setNutritionGoalInput((prev) => ({
                            ...prev,
                            [field]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={handleSaveNutritionGoal}>
                    Save goal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNutritionGoalInput(targets);
                      setNutritionGoalError(null);
                      setNutritionGoalOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {nutritionGoalError && (
                  <p className="text-sm text-red-400">{nutritionGoalError}</p>
                )}
              </div>
            )}
            <MacroBars current={current} targets={targets} />
            {hasMealPlan ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">
                    {isToday(date) ? "Today's meal plan" : `Meal plan · ${format(date, "MMM d")}`}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tap a meal, then choose which option you ate. Macros update from your pick.
                  </p>
                </div>
                <MealPlanChecklist
                  clientId={clientId}
                  dateKey={dateKey}
                  slots={plannedMealSlots}
                  onMealsChange={refreshMeals}
                />
              </div>
            ) : nutritionPlan ? (
              <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No meals in this day menu yet. Add meals to your scheduled menu to see them here.
              </p>
            ) : null}
            {extraLoggedMeals.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Logged food</Label>
                <ul className="space-y-2">
                  {extraLoggedMeals.map((meal) => {
                    const summary = formatMealMacrosSummary(normalizeMealMacros(meal));
                    return (
                      <li
                        key={meal.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge className="capitalize">{meal.meal_type}</Badge>
                            <span className="font-medium">{meal.name}</span>
                          </div>
                          {summary && (
                            <p className="text-xs text-muted-foreground">{summary}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-red-400"
                          disabled={isPending}
                          onClick={() => handleDeleteMeal(meal.id)}
                          aria-label={`Remove ${meal.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {!hasMealPlan && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Logged food</Label>
              {dailyMeals.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  No food logged yet. Use Log meal to track intake toward your goal.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dailyMeals.filter((m) => !m.slot).map((meal) => {
                    const summary = formatMealMacrosSummary(normalizeMealMacros(meal));
                    return (
                      <li
                        key={meal.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge className="capitalize">{meal.meal_type}</Badge>
                            <span className="font-medium">{meal.name}</span>
                          </div>
                          {summary && (
                            <p className="text-xs text-muted-foreground">{summary}</p>
                          )}
                          {meal.foods?.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {meal.foods.map((food) => food.name).join(", ")}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-red-400"
                          disabled={isPending}
                          onClick={() => handleDeleteMeal(meal.id)}
                          aria-label={`Remove ${meal.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            )}
          </CardContent>
        </Card>

        <Card id="dashboard-water" className={sectionCompletedCardClass(waterCompleted)}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Water Intake
                {waterCompleted && <SectionCompletedBadge />}
                <MissedButton
                  count={waterMissed ? 1 : 0}
                  title="Missed water goal"
                  hint="Keep a bottle nearby and sip throughout the day."
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
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  waterCompleted && "text-green-400"
                )}
              >
                {localWaterMl.toLocaleString()} / {waterGoalMl.toLocaleString()} ml
                {waterCompleted ? " · goal reached" : ` · goal by ${WATER_DEADLINE}`}
              </p>
              <GoalToggle
                label="Change water goal"
                open={waterGoalOpen}
                onToggle={() => {
                  setGoalError(null);
                  setWaterGoalOpen((open) => !open);
                }}
              />
            </div>
            {waterCompleted && (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
                aria-label="Water goal completed"
              >
                <Check className="h-4 w-4" />
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <WaterRing
                current={localWaterMl}
                goal={waterGoalMl}
                onAdd={handleAddWater}
                loading={isPending}
              />
            </div>
            {waterGoalOpen && (
              <div className="space-y-3 border-t border-border pt-4">
                <Label htmlFor="water-goal">Daily water goal</Label>
                <div className="flex flex-wrap gap-2">
                  {WATER_GOAL_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isPending}
                      onClick={() => saveWaterGoal(preset)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        waterGoalMl === preset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {preset} ml
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="water-goal"
                    type="number"
                    min={500}
                    max={10000}
                    step={100}
                    placeholder="Custom goal (ml)"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={isPending}
                    onClick={handleSaveWaterGoal}
                  >
                    Save goal
                  </Button>
                </div>
                {goalError && <p className="text-sm text-red-400">{goalError}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
