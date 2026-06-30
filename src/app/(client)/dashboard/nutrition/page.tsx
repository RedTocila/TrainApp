import { requireClient } from "@/lib/actions/auth";
import {
  getActivePersonalNutritionPlanId,
  getNutritionFoldersForMove,
  getPersonalNutritionPlansInFolder,
} from "@/lib/actions/user-nutrition";
import { getScheduledNutritionDatesByPlan } from "@/lib/actions/user-nutrition-schedule";
import { AllMealPlansPage } from "@/components/all-meal-plans-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";

export default async function NutritionPage() {
  await requireClient();

  const [plans, activePersonalPlanId, scheduledDatesByPlan, folders] =
    await Promise.all([
      getPersonalNutritionPlansInFolder(),
      getActivePersonalNutritionPlanId(),
      getScheduledNutritionDatesByPlan(),
      getNutritionFoldersForMove(),
    ]);

  return (
    <PageTransition>
      <ScrollToHash />
      <div id="dashboard-nutrition" className="mx-auto max-w-3xl space-y-3">
        <AllMealPlansPage
          plans={plans}
          activePlanId={activePersonalPlanId}
          scheduledDatesByPlan={scheduledDatesByPlan}
          folders={folders}
        />
      </div>
    </PageTransition>
  );
}
