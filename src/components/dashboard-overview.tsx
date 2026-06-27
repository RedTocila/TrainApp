"use client";

import { useCallback, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { DailyTracker } from "@/components/daily-tracker";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getDailyLog } from "@/lib/actions/logs";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { CoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
import { formatDateKey } from "@/lib/utils";
import type { DailyLog, DailyMealLog, Meal, MealSlot } from "@/lib/types";

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function DashboardOverview({
  clientId,
  initialLog,
  initialDailyMeals,
  mealLibrary,
  hasAiAccess,
  targets: initialTargets,
  personalPlanId,
  initialWaterGoalMl,
  nutritionPlan: initialNutritionPlan,
  coachNutritionPlanState,
  goal,
}: {
  clientId: string;
  initialLog: DailyLog | null;
  initialDailyMeals: DailyMealLog[];
  mealLibrary: PersonalMealLibraryItem[];
  hasAiAccess: boolean;
  targets: MacroTargets;
  personalPlanId?: string | null;
  initialWaterGoalMl: number;
  goal?: string | null;
  nutritionPlan?: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
  } | null;
  coachNutritionPlanState: CoachNutritionPlanViewState;
}) {
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);
  const [log, setLog] = useState(initialLog);
  const [dailyMeals, setDailyMeals] = useState(initialDailyMeals);
  const [targets, setTargets] = useState(initialTargets);
  const [waterGoalMl, setWaterGoalMl] = useState(initialWaterGoalMl);
  const [nutritionPlan, setNutritionPlan] = useState(initialNutritionPlan);

  const loadOverview = useCallback(async () => {
    const [fetchedLog, fetchedMeals, planForDate] = await Promise.all([
      getDailyLog(clientId, dateKey),
      getDailyMealLogs(clientId, dateKey),
      getNutritionPlanForDate(clientId, dateKey),
    ]);
    setLog(fetchedLog);
    setDailyMeals(fetchedMeals);

    if (planForDate?.meals?.length) {
      setNutritionPlan({
        title: planForDate.title,
        meals: planForDate.meals as Meal[],
        scheduled: planForDate.scheduled,
        activeSlots: planForDate.activeSlots,
        kind: planForDate.kind,
      });
    } else {
      setNutritionPlan(null);
    }
  }, [clientId, dateKey]);

  const isReady = useDashboardDateFetch(dateKey, loadOverview, [clientId], {
    trackGlobalLoading: true,
  });

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      waterMl={isReady ? (log?.water_ml ?? 0) : 0}
      dailyMeals={isReady ? dailyMeals : []}
      onDailyMealsChange={setDailyMeals}
      mealLibrary={mealLibrary}
      hasAiAccess={hasAiAccess}
      targets={targets}
      onTargetsChange={setTargets}
      personalPlanId={personalPlanId}
      waterGoalMl={waterGoalMl}
      onWaterGoalChange={setWaterGoalMl}
      nutritionPlan={isReady ? nutritionPlan : null}
      coachNutritionPlanState={coachNutritionPlanState}
      goal={goal}
    />
  );
}
