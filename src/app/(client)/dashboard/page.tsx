import { Suspense } from "react";
import { requireClient } from "@/lib/actions/auth";
import { formatDateKey } from "@/lib/utils";
import { DashboardHomeView } from "@/components/dashboard-home-view";
import { DashboardHomeBelowFold } from "@/components/dashboard-home-below-fold";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { DashboardEnrichmentProvider } from "@/components/dashboard-enrichment-provider";
import { loadDashboardToday } from "@/lib/dashboard-home-data";
import { dashboardEnrichmentRange } from "@/lib/dashboard-window";
import { DashboardHomeBelowFoldSkeleton } from "@/components/dashboard-page-skeleton";

export default async function DashboardPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);
  const { from: rangeStart, to: rangeEnd } = dashboardEnrichmentRange(
    today,
    profile.created_at
  );

  const todayData = await loadDashboardToday(
    profile,
    dateKey,
    rangeStart,
    rangeEnd
  );

  return (
    <DashboardEnrichmentProvider
      clientId={profile.id}
      initialEnrichment={todayData.initialEnrichment}
    >
      <ScrollToHash />
      <DashboardHomeView
        clientId={profile.id}
        seedDateKey={dateKey}
        schedule={todayData.schedule}
        gender={profile.gender}
        initialWorkout={todayData.initialWorkouts[0] ?? null}
        initialWorkouts={todayData.initialWorkouts}
        initialWorkoutCompleted={todayData.initialWorkoutCompleted}
        initialWorkoutResults={todayData.initialWorkoutResults}
        initialLog={todayData.dailyLog}
        initialDailyMeals={todayData.dailyMeals}
        hasAiAccess={todayData.hasAiAccess}
        targets={todayData.targets}
        personalPlanId={todayData.personalNutritionPlanId}
        waterGoalMl={todayData.waterGoalMl}
        nutritionPlan={todayData.nutritionSummary}
        goal={profile.goal ?? null}
        initialWaterMl={todayData.dailyLog?.water_ml ?? 0}
        initialCardios={todayData.initialCardios}
        initialCardioCompletions={todayData.initialCardioCompletionById}
        profile={profile}
      >
        <Suspense fallback={<DashboardHomeBelowFoldSkeleton />}>
          <DashboardHomeBelowFold
            profile={profile}
            dateKey={dateKey}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            personalPlanId={todayData.personalNutritionPlanId}
            nutritionPlan={todayData.nutritionSummary}
            weightLog={todayData.weightLog}
          />
        </Suspense>
      </DashboardHomeView>
    </DashboardEnrichmentProvider>
  );
}
