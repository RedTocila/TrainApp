import { requireClient } from "@/lib/actions/auth";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import {
  getActivePersonalNutritionPlanId,
  getNutritionFoldersForMove,
  getPersonalNutritionPlansInFolder,
} from "@/lib/actions/user-nutrition";
import { getScheduledNutritionDatesByPlan } from "@/lib/actions/user-nutrition-schedule";
import { getClientPlanRequests } from "@/lib/actions/custom-plans";
import { AllMealPlansPage } from "@/components/all-meal-plans-page";
import { NutritionPlanPdfViewer } from "@/components/nutrition-plan-pdf-viewer";
import { MacroSummary } from "@/components/programs/macro-summary";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRound } from "lucide-react";

export default async function NutritionPage() {
  const profile = await requireClient();

  const [plans, assignment, activePersonalPlanId, planRequests, scheduledDatesByPlan, folders] =
    await Promise.all([
      getPersonalNutritionPlansInFolder(),
      getClientNutritionAssignment(profile.id),
      getActivePersonalNutritionPlanId(),
      getClientPlanRequests(profile.id),
      getScheduledNutritionDatesByPlan(),
      getNutritionFoldersForMove(),
    ]);

  const assignedPlan = assignment?.nutrition_plans;
  const showCoachPlan = assignedPlan && !assignedPlan.is_personal;
  const deliveredNutritionPdfRequest = planRequests.find(
    (r) =>
      r.type === "diet" &&
      r.delivered_nutrition_pdf_path &&
      ["delivered", "implemented", "completed"].includes(r.status)
  );

  return (
    <PageTransition>
      <ScrollToHash />
      <div id="dashboard-nutrition" className="mx-auto max-w-3xl space-y-3">
        {deliveredNutritionPdfRequest && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-emerald-400" />
                <p className="font-bold">Coach nutrition plan</p>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  PDF
                </Badge>
              </div>
              <NutritionPlanPdfViewer requestId={deliveredNutritionPdfRequest.id} />
            </CardContent>
          </Card>
        )}

        {showCoachPlan && !deliveredNutritionPdfRequest && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-emerald-400" />
                <p className="font-bold">{assignedPlan.title}</p>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  Coach
                </Badge>
              </div>
              <MacroSummary
                calories={assignedPlan.target_calories}
                protein={assignedPlan.target_protein}
                carbs={assignedPlan.target_carbs}
                fat={assignedPlan.target_fat}
              />
            </CardContent>
          </Card>
        )}

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
