import { requireClient } from "@/lib/actions/auth";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import {
  getActivePersonalNutritionPlanId,
  getPersonalNutritionPlans,
} from "@/lib/actions/user-nutrition";
import { getClientPlanRequests } from "@/lib/actions/custom-plans";
import { AllMealPlansPage } from "@/components/all-meal-plans-page";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { NutritionPlanPdfViewer } from "@/components/nutrition-plan-pdf-viewer";
import { MacroSummary } from "@/components/programs/macro-summary";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NutritionPage() {
  const profile = await requireClient();

  const [plans, assignment, activePersonalPlanId, planRequests] = await Promise.all([
    getPersonalNutritionPlans(),
    getClientNutritionAssignment(profile.id),
    getActivePersonalNutritionPlanId(),
    getClientPlanRequests(profile.id),
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
      <div id="dashboard-nutrition" className="mx-auto max-w-3xl space-y-5">
        <NutritionSectionTabs />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Apple className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black">Meal plans</h1>
              <p className="text-xs text-muted-foreground">{plans.length} plans</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/ai/plans/nutrition">
              <Button size="sm" variant="secondary">
                AI plan
              </Button>
            </Link>
          </div>
        </div>

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

        {activePersonalPlanId && !showCoachPlan && assignedPlan && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-primary" />
                <p className="font-bold">{assignedPlan.title}</p>
                <Badge className="ml-auto bg-primary/15 text-[10px] text-primary">Active</Badge>
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

        {planRequests.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-sm">
              You have {planRequests.length} pending plan request
              {planRequests.length === 1 ? "" : "s"}.
            </CardContent>
          </Card>
        )}

        <AllMealPlansPage plans={plans} activePlanId={activePersonalPlanId} />
      </div>
    </PageTransition>
  );
}
