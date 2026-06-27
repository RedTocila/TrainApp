import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFoldersForMove,
  getPersonalMealsLibrary,
  getPersonalNutritionPlans,
} from "@/lib/actions/user-nutrition";
import { MealsHubPage } from "@/components/meals-hub-page";
import { NutritionPageHeader } from "@/components/nutrition-page-header";
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
        <NutritionPageHeader title="Meal library" />
        <MealsHubPage meals={meals} folders={folders} plans={plans} />
      </div>
    </PageTransition>
  );
}
