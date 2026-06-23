"use client";

import { useEffect, useState, useTransition } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { DailyTracker } from "@/components/daily-tracker";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getDailyLog } from "@/lib/actions/logs";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import { getPrimaryMealsForDayMenu, sumDayMenuMacros } from "@/lib/meal-slots";
import { formatDateKey } from "@/lib/utils";
import type { DailyLog, DailyMealLog, Meal } from "@/lib/types";

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
  targets: initialTargets,
  personalPlanId,
  initialWaterGoalMl,
  nutritionPlan: initialNutritionPlan,
}: {
  clientId: string;
  initialLog: DailyLog | null;
  initialDailyMeals: DailyMealLog[];
  mealLibrary: PersonalMealLibraryItem[];
  targets: MacroTargets;
  personalPlanId?: string | null;
  initialWaterGoalMl: number;
  nutritionPlan?: { title: string; meals: Meal[]; scheduled?: boolean } | null;
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

      if (planForDate) {
        const meals = (planForDate.meals ?? []) as Meal[];
        const primary = getPrimaryMealsForDayMenu(meals);
        setNutritionPlan({
          title: planForDate.title,
          meals: primary.length > 0 ? primary : meals,
          scheduled: planForDate.scheduled,
        });
        const totals = sumDayMenuMacros(meals);
        if (totals.calories > 0) {
          setTargets(totals);
        } else {
          setTargets(initialTargets);
        }
      } else {
        setNutritionPlan(null);
        setTargets(initialTargets);
      }
    });
  }, [selectedDate, clientId, initialTargets]);

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      waterMl={log?.water_ml ?? 0}
      dailyMeals={dailyMeals}
      onDailyMealsChange={setDailyMeals}
      mealLibrary={mealLibrary}
      targets={targets}
      onTargetsChange={setTargets}
      personalPlanId={personalPlanId}
      waterGoalMl={waterGoalMl}
      onWaterGoalChange={setWaterGoalMl}
      nutritionPlan={nutritionPlan}
    />
  );
}
