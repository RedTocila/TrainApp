"use client";

import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { DailyTracker } from "@/components/daily-tracker";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getDailyLog } from "@/lib/actions/logs";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
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
  trainerNutritionPdfRequestId,
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
  } | null;
  trainerNutritionPdfRequestId?: string | null;
}) {
  const { selectedDate } = useSelectedDate();
  const [log, setLog] = useState(initialLog);
  const [dailyMeals, setDailyMeals] = useState(initialDailyMeals);
  const [targets, setTargets] = useState(initialTargets);
  const [waterGoalMl, setWaterGoalMl] = useState(initialWaterGoalMl);
  const [nutritionPlan, setNutritionPlan] = useState(initialNutritionPlan);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);

    startTransition(async () => {
      const [fetchedLog, fetchedMeals, planForDate] = await Promise.all([
        getDailyLog(clientId, dateKey),
        getDailyMealLogs(clientId, dateKey),
        getNutritionPlanForDate(clientId, dateKey),
      ]);
      setLog(fetchedLog);
      setDailyMeals(fetchedMeals);

      if (planForDate?.scheduled) {
        const meals = (planForDate.meals ?? []) as Meal[];
        setNutritionPlan({
          title: planForDate.title,
          meals,
          scheduled: true,
          activeSlots: planForDate.activeSlots,
        });
      } else {
        setNutritionPlan(null);
      }
    });
  }, [selectedDate, clientId]);

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      waterMl={log?.water_ml ?? 0}
      dailyMeals={dailyMeals}
      onDailyMealsChange={setDailyMeals}
      mealLibrary={mealLibrary}
      hasAiAccess={hasAiAccess}
      targets={targets}
      onTargetsChange={setTargets}
      personalPlanId={personalPlanId}
      waterGoalMl={waterGoalMl}
      onWaterGoalChange={setWaterGoalMl}
      nutritionPlan={nutritionPlan}
      trainerNutritionPdfRequestId={trainerNutritionPdfRequestId}
      goal={goal}
    />
  );
}
