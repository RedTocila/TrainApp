"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import {
  neverInEnrichmentRange,
  useOptionalDashboardEnrichment,
} from "@/components/dashboard-enrichment-provider";
import { DailyTracker } from "@/components/daily-tracker";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getDailyLog } from "@/lib/actions/logs";
import { getPersonalMealsLibrary } from "@/lib/actions/user-nutrition";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import {
  dashboardDayCacheKey,
  getDashboardDayCache,
  isDashboardDayCacheFresh,
} from "@/lib/dashboard-day-cache";
import {
  getNutritionExtrasCache,
  isNutritionExtrasCacheFresh,
  setNutritionExtrasCache,
  type NutritionExtrasCache,
} from "@/lib/dashboard-route-cache";
import type { DailyLog, DailyMealLog, Meal, MealSlot } from "@/lib/types";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import { formatDateKey } from "@/lib/utils";

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

const EMPTY_EXTRAS: NutritionExtrasCache = {
  mealLibrary: [],
  personalPlanId: null,
  nutritionPlan: null,
};

export function NutritionDayClient({
  clientId,
  targets,
  initialWaterGoalMl,
  goal,
  hasAiAccess,
}: {
  clientId: string;
  targets: MacroTargets;
  initialWaterGoalMl: number;
  goal: string | null;
  hasAiAccess: boolean;
}) {
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const enrichmentCtx = useOptionalDashboardEnrichment();
  const enrichment = enrichmentCtx?.enrichment;
  const isInEnrichmentRange =
    enrichmentCtx?.isInEnrichmentRange ?? neverInEnrichmentRange;
  const dateKey = formatDateKey(selectedDate);
  const [waterGoalMl, setWaterGoalMl] = useState(initialWaterGoalMl);
  const [localMeals, setLocalMeals] = useState<DailyMealLog[] | null>(null);
  const cachedExtras = getNutritionExtrasCache(clientId);
  const [extras, setExtras] = useState<NutritionExtrasCache>(
    cachedExtras ?? EMPTY_EXTRAS
  );

  useEffect(() => {
    setLocalMeals(null);
  }, [dateKey]);

  const enrichmentMeals = enrichment?.mealsByDate[dateKey];
  const enrichmentWater = enrichment?.waterByDate[dateKey];
  const overviewCacheKey = dashboardDayCacheKey(clientId, "overview", dateKey);

  const seedOverview = useMemo((): OverviewDayData | undefined => {
    const cachedOverview = getDashboardDayCache<OverviewDayData>(overviewCacheKey);
    if (cachedOverview) return cachedOverview;

    const hasEnrichment =
      isInEnrichmentRange(dateKey) &&
      (enrichmentMeals !== undefined || enrichmentWater !== undefined);

    if (hasEnrichment) {
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
        nutritionPlan:
          dateKey === todayKey ? (extras.nutritionPlan ?? null) : null,
      };
    }

    if (dateKey === todayKey && cachedExtras?.nutritionPlan) {
      return {
        log: null,
        dailyMeals: [],
        nutritionPlan: cachedExtras.nutritionPlan,
      };
    }

    return undefined;
  }, [
    clientId,
    dateKey,
    overviewCacheKey,
    enrichmentMeals,
    enrichmentWater,
    extras.nutritionPlan,
    cachedExtras?.nutritionPlan,
    isInEnrichmentRange,
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
      isDashboardDayCacheFresh(overviewCacheKey) ||
      (isInEnrichmentRange(dateKey) &&
        enrichmentMeals !== undefined &&
        enrichmentWater !== undefined),
    fetcher: loadOverview,
    trackGlobalLoading: false,
  });

  useEffect(() => {
    if (isNutritionExtrasCacheFresh(clientId)) return;

    let cancelled = false;

    void (async () => {
      const [mealLibrary, nutritionAssignment, scheduledPlanForToday] =
        await Promise.all([
          getPersonalMealsLibrary(),
          getClientNutritionAssignment(clientId),
          getNutritionPlanForDate(clientId, dateKey),
        ]);

      if (cancelled) return;

      const nutritionPlan = nutritionAssignment?.nutrition_plans;
      const personalPlanId =
        nutritionPlan?.is_personal && nutritionAssignment?.plan_id
          ? nutritionAssignment.plan_id
          : null;

      const nutritionSummary =
        scheduledPlanForToday?.meals?.length
          ? {
              title: scheduledPlanForToday.title,
              meals: scheduledPlanForToday.meals as Meal[],
              scheduled: scheduledPlanForToday.scheduled,
              activeSlots: scheduledPlanForToday.activeSlots,
              kind: scheduledPlanForToday.kind,
              planId: scheduledPlanForToday.planId,
            }
          : null;

      const next: NutritionExtrasCache = {
        mealLibrary,
        personalPlanId,
        nutritionPlan: nutritionSummary,
      };

      setExtras(next);
      setNutritionExtrasCache(clientId, next);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, dateKey]);

  const display = overview ?? seedOverview;
  const dailyMeals =
    localMeals ?? display?.dailyMeals ?? enrichmentMeals ?? [];

  return (
    <DailyTracker
      clientId={clientId}
      date={selectedDate}
      waterMl={display?.log?.water_ml ?? enrichmentWater ?? 0}
      dailyMeals={dailyMeals}
      onDailyMealsChange={(meals) => {
        setLocalMeals(meals);
      }}
      mealLibrary={extras.mealLibrary}
      hasAiAccess={hasAiAccess}
      targets={targets}
      personalPlanId={extras.personalPlanId}
      waterGoalMl={waterGoalMl}
      onWaterGoalChange={setWaterGoalMl}
      nutritionPlan={display?.nutritionPlan ?? extras.nutritionPlan ?? null}
      goal={goal}
      variant="full"
      layout="detail"
      readOnly={readOnly}
    />
  );
}
