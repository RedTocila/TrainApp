import { requireClient } from "@/lib/actions/auth";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import { getDailyLog } from "@/lib/actions/logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getPersonalMealsLibrary } from "@/lib/actions/user-nutrition";
import { getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import { getCoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { DashboardOverview } from "@/components/dashboard-overview";
import { hasAiAccess } from "@/lib/subscription";
import { formatDateKey } from "@/lib/utils";

export default async function DashboardDayNutritionPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);

  const [
    nutritionAssignment,
    dailyLog,
    dailyMeals,
    mealLibrary,
    scheduledPlanForToday,
    coachNutritionPlanState,
  ] = await Promise.all([
    getClientNutritionAssignment(profile.id),
    getDailyLog(profile.id, dateKey),
    getDailyMealLogs(profile.id, dateKey),
    getPersonalMealsLibrary(),
    getNutritionPlanForDate(profile.id, dateKey),
    getCoachNutritionPlanViewState(profile.id),
  ]);

  const nutritionPlan = nutritionAssignment?.nutrition_plans;
  const personalNutritionPlanId =
    nutritionPlan?.is_personal && nutritionAssignment?.plan_id
      ? nutritionAssignment.plan_id
      : null;

  const targets = {
    calories: profile.target_calories ?? nutritionPlan?.target_calories ?? 2000,
    protein: profile.target_protein ?? nutritionPlan?.target_protein ?? 150,
    carbs: profile.target_carbs ?? nutritionPlan?.target_carbs ?? 200,
    fat: profile.target_fat ?? nutritionPlan?.target_fat ?? 65,
  };

  const nutritionSummary =
    scheduledPlanForToday?.meals?.length
      ? {
          title: scheduledPlanForToday.title,
          meals: scheduledPlanForToday.meals,
          scheduled: scheduledPlanForToday.scheduled,
          activeSlots: scheduledPlanForToday.activeSlots,
          kind: scheduledPlanForToday.kind,
        }
      : null;

  return (
    <DashboardDayDetailShell>
      <DashboardOverview
        clientId={profile.id}
        initialLog={dailyLog}
        initialDailyMeals={dailyMeals}
        mealLibrary={mealLibrary}
        hasAiAccess={hasAiAccess(profile)}
        targets={targets}
        personalPlanId={personalNutritionPlanId}
        initialWaterGoalMl={profile.water_goal_ml ?? 2500}
        nutritionPlan={nutritionSummary}
        coachNutritionPlanState={coachNutritionPlanState}
        goal={profile.goal ?? null}
        variant="full"
        layout="detail"
      />
    </DashboardDayDetailShell>
  );
}
