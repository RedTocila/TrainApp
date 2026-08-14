import { BodyMetricsSection } from "@/components/body-metrics-section";
import { ProgressPhotosCard } from "@/components/progress-photos-card";
import { HabitsTracker } from "@/components/habits-tracker";
import {
  DashboardEnrichmentHydrator,
  DashboardNutritionExtrasHydrator,
  DashboardScheduleHydrator,
} from "@/components/dashboard-deferred-hydrators";
import { loadDashboardBelowFold } from "@/lib/dashboard-home-data";
import type { BodyWeightLog, Meal, MealSlot, Profile } from "@/lib/types";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";

export async function DashboardHomeBelowFold({
  profile,
  dateKey,
  rangeStart,
  rangeEnd,
  personalPlanId,
  nutritionPlan,
  weightLog,
}: {
  profile: Profile;
  dateKey: string;
  rangeStart: string;
  rangeEnd: string;
  personalPlanId: string | null;
  nutritionPlan: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
    planId?: string;
  } | null;
  weightLog: BodyWeightLog | null;
}) {
  const deferred = await loadDashboardBelowFold(
    profile,
    dateKey,
    rangeStart,
    rangeEnd
  );

  return (
    <>
      <DashboardEnrichmentHydrator data={deferred.enrichment} />
      <DashboardScheduleHydrator
        scheduledNutritionDays={deferred.scheduledNutritionDays}
        habitsByDate={deferred.habitsByDate}
      />
      <DashboardNutritionExtrasHydrator
        clientId={profile.id}
        extras={{
          mealLibrary: deferred.mealLibrary,
          personalPlanId,
          nutritionPlan,
        }}
      />

      <BodyMetricsSection
        clientId={profile.id}
        heightCm={profile.height_cm}
        intakeWeightKg={profile.intake_weight_kg}
        accountCreatedAt={profile.created_at}
        initialHistory={deferred.weightHistory}
        initialLog={weightLog}
      />

      <ProgressPhotosCard
        clientId={profile.id}
        initialSets={deferred.progressPhotoSets}
        initialCurrentUrls={deferred.initialCurrentUrls}
      />

      <HabitsTracker
        clientId={profile.id}
        initialHabits={deferred.habits}
        suggestedHabits={deferred.suggestedHabits}
      />
    </>
  );
}
