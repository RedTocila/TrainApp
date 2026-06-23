import { requireClient } from "@/lib/actions/auth";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import {
  getActivePersonalNutritionPlanId,
  getNutritionFoldersOverview,
} from "@/lib/actions/user-nutrition";
import { NutritionFoldersPage } from "@/components/nutrition-folders-page";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function NutritionPage() {
  const profile = await requireClient();

  const [folders, assignment, activePersonalPlanId] = await Promise.all([
    getNutritionFoldersOverview(),
    getClientNutritionAssignment(profile.id),
    getActivePersonalNutritionPlanId(),
  ]);

  const assignedPlan = assignment?.nutrition_plans;
  const showCoachPlan =
    assignedPlan && !assignedPlan.is_personal;

  return (
    <PageTransition>
      <ScrollToHash />
      <div id="dashboard-nutrition" className="mx-auto max-w-3xl space-y-6">
        {showCoachPlan && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Coach plan: {assignedPlan.title}</p>
                <Badge variant="secondary">Assigned by coach</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {assignedPlan.target_calories} cal · {assignedPlan.target_protein}g protein ·{" "}
                {assignedPlan.meals?.length ?? 0} meals
              </p>
            </CardContent>
          </Card>
        )}

        {activePersonalPlanId && !showCoachPlan && assignedPlan && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Active: {assignedPlan.title}</p>
                <Badge className="bg-primary/15 text-primary">On dashboard</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <NutritionFoldersPage folders={folders} />
      </div>
    </PageTransition>
  );
}
