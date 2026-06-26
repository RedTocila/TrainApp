import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFoldersForMove,
  getPersonalMealsLibrary,
  getPersonalNutritionPlans,
} from "@/lib/actions/user-nutrition";
import { MealsHubPage } from "@/components/meals-hub-page";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { PageTransition } from "@/components/page-transition";

export default async function MyMealsRoute() {
  await requireClient();

  const [meals, folders, plans] = await Promise.all([
    getPersonalMealsLibrary(),
    getNutritionFoldersForMove(),
    getPersonalNutritionPlans(),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Meal library</h1>
          <NutritionSectionTabs />
        </div>
        <MealsHubPage meals={meals} folders={folders} plans={plans} />
      </div>
    </PageTransition>
  );
}
