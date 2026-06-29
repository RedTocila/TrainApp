"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import {
  neverInEnrichmentRange,
  useOptionalDashboardEnrichment,
} from "@/components/dashboard-enrichment-provider";
import { DailyTracker } from "@/components/daily-tracker";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import {
  setNutritionExtrasCache,
  type NutritionExtrasCache,
} from "@/lib/dashboard-route-cache";
import { getDailyLog } from "@/lib/actions/logs";
import type { CoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { nutritionPlanFromSchedule } from "@/lib/nutrition-plan-from-schedule";
import { formatDateKey } from "@/lib/utils";
import type { DailyLog, DailyMealLog, Meal, MealSlot } from "@/lib/types";

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type OverviewDayData = {
  log: DailyLog | null;
  dailyMeals: DailyMealLog[];
  nutritionPlan: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
    planId?: string;
  } | null;
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
  variant = "full",
  layout = "card",
  schedule,
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
  nutritionPlan?: OverviewDayData["nutritionPlan"];
  coachNutritionPlanState: CoachNutritionPlanViewState;
  variant?: "full" | "compact";
  layout?: "card" | "detail";
  schedule?: ClientSchedule;
}) {
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const enrichmentCtx = useOptionalDashboardEnrichment();
  const enrichment = enrichmentCtx?.enrichment;
  const isInEnrichmentRange =
    enrichmentCtx?.isInEnrichmentRange ?? neverInEnrichmentRange;
  const dateKey = formatDateKey(selectedDate);
  const [targets, setTargets] = useState(initialTargets);
  const [waterGoalMl, setWaterGoalMl] = useState(initialWaterGoalMl);
  const [localMeals, setLocalMeals] = useState<DailyMealLog[] | null>(null);

  useEffect(() => {
    setLocalMeals(null);
  }, [dateKey]);

  const enrichmentMeals = enrichment?.mealsByDate[dateKey];
  const enrichmentWater = enrichment?.waterByDate[dateKey];
  const scheduleNutritionPlan = schedule
    ? nutritionPlanFromSchedule(selectedDate, schedule)
    : null;

  const seedOverview = useMemo((): OverviewDayData | undefined => {
    const hasEnrichment =
      isInEnrichmentRange(dateKey) &&
      (enrichmentMeals !== undefined || enrichmentWater !== undefined);

    if (hasEnrichment) {
      return {
        log: {
          id: initialLog?.id ?? "",
          client_id: clientId,
          date: dateKey,
          water_ml: enrichmentWater ?? 0,
          calories: initialLog?.calories ?? 0,
          protein: initialLog?.protein ?? 0,
          carbs: initialLog?.carbs ?? 0,
          fat: initialLog?.fat ?? 0,
        },
        dailyMeals: enrichmentMeals ?? [],
        nutritionPlan:
          dateKey === todayKey
            ? (initialNutritionPlan ?? null)
            : scheduleNutritionPlan,
      };
    }

    if (dateKey === todayKey) {
      return {
        log: initialLog,
        dailyMeals: initialDailyMeals,
        nutritionPlan: initialNutritionPlan ?? null,
      };
    }

    if (schedule && isInEnrichmentRange(dateKey)) {
      return {
        log: {
          id: "",
          client_id: clientId,
          date: dateKey,
          water_ml: enrichmentWater ?? 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        dailyMeals: enrichmentMeals ?? [],
        nutritionPlan: scheduleNutritionPlan,
      };
    }

    return undefined;
  }, [
    clientId,
    dateKey,
    enrichmentMeals,
    enrichmentWater,
    initialDailyMeals,
    initialLog,
    initialNutritionPlan,
    isInEnrichmentRange,
    schedule,
    scheduleNutritionPlan,
    todayKey,
  ]);

  const loadOverview = useCallback(async (): Promise<OverviewDayData> => {
    const [fetchedLog, fetchedMeals, planForDate] = await Promise.all([
      getDailyLog(clientId, dateKey),
      getDailyMealLogs(clientId, dateKey),
      getNutritionPlanForDate(clientId, dateKey),
    ]);

    let nutritionPlan: OverviewDayData["nutritionPlan"] = null;
    if (planForDate?.meals?.length) {
      nutritionPlan = {
        title: planForDate.title,
        meals: planForDate.meals as Meal[],
        scheduled: planForDate.scheduled,
        activeSlots: planForDate.activeSlots,
        kind: planForDate.kind,
        planId: planForDate.planId,
      };
    }

    return {
      log: fetchedLog,
      dailyMeals: fetchedMeals,
      nutritionPlan,
    };
  }, [clientId, dateKey]);

  const { data: overview } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "overview",
    seed: seedOverview,
    skipFetch:
      isInEnrichmentRange(dateKey) &&
      enrichmentMeals !== undefined &&
      enrichmentWater !== undefined &&
      (dateKey === todayKey || scheduleNutritionPlan !== null || !schedule),
    fetcher: loadOverview,
    trackGlobalLoading: true,
  });

  const display = overview ?? seedOverview;
  const dailyMeals =
    localMeals ?? display?.dailyMeals ?? enrichmentMeals ?? [];

  useEffect(() => {
    setNutritionExtrasCache(clientId, {
      mealLibrary,
      coachNutritionPlanState,
      personalPlanId: personalPlanId ?? null,
      nutritionPlan: display?.nutritionPlan ?? initialNutritionPlan ?? null,
    });
  }, [
    clientId,
    mealLibrary,
    coachNutritionPlanState,
    personalPlanId,
    display?.nutritionPlan,
    initialNutritionPlan,
  ]);

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      waterMl={display?.log?.water_ml ?? enrichmentWater ?? 0}
      dailyMeals={dailyMeals}
      onDailyMealsChange={(meals) => {
        setLocalMeals(meals);
      }}
      mealLibrary={mealLibrary}
      hasAiAccess={hasAiAccess}
      targets={targets}
      onTargetsChange={setTargets}
      personalPlanId={personalPlanId}
      waterGoalMl={waterGoalMl}
      onWaterGoalChange={setWaterGoalMl}
      nutritionPlan={display?.nutritionPlan ?? null}
      coachNutritionPlanState={coachNutritionPlanState}
      goal={goal}
      variant={variant}
      layout={layout}
      readOnly={readOnly}
    />
  );
}
