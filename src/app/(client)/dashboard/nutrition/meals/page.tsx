import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFoldersForMove,
  getPersonalMealsLibrary,
  getPersonalNutritionPlans,
} from "@/lib/actions/user-nutrition";
import { MealsHubPage } from "@/components/meals-hub-page";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function MyMealsRoute() {
  await requireClient();

  const [meals, folders, plans] = await Promise.all([
    getPersonalMealsLibrary(),
    getNutritionFoldersForMove(),
    getPersonalNutritionPlans(),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-0">
        <NutritionSectionTabs />
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/nutrition">
            <Button variant="ghost" size="sm" className="-ml-2 w-fit">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to meal plans
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">Meals</h1>
            <p className="text-sm text-muted-foreground">
              Templates + your saved meals, organized by meal type.
            </p>
          </div>
        </div>

        <MealsHubPage meals={meals} folders={folders} plans={plans} />
      </div>
    </PageTransition>
  );
}
