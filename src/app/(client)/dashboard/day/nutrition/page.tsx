import { requireClient } from "@/lib/actions/auth";
import { DashboardDayDetailShell } from "@/components/dashboard-day-detail-shell";
import { NutritionDayClient } from "@/components/nutrition-day-client";
import { hasAiAccess } from "@/lib/subscription";

export default async function DashboardDayNutritionPage() {
  const profile = await requireClient();

  const targets = {
    calories: profile.target_calories ?? 2000,
    protein: profile.target_protein ?? 150,
    carbs: profile.target_carbs ?? 200,
    fat: profile.target_fat ?? 65,
  };

  return (
    <DashboardDayDetailShell>
      <NutritionDayClient
        clientId={profile.id}
        targets={targets}
        initialWaterGoalMl={profile.water_goal_ml ?? 2500}
        goal={profile.goal ?? null}
        hasAiAccess={hasAiAccess(profile)}
      />
    </DashboardDayDetailShell>
  );
}
