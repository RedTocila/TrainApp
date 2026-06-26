import { requireClient } from "@/lib/actions/auth";
import { getPersonalNutritionPlans } from "@/lib/actions/user-nutrition";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { RecipeTemplatesPage } from "@/components/recipe-templates-page";
import { PageTransition } from "@/components/page-transition";

export default async function NutritionTemplatesPage() {
  await requireClient();
  const plans = await getPersonalNutritionPlans();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Recipe book</h1>
          <NutritionSectionTabs />
        </div>
        <RecipeTemplatesPage plans={plans} />
      </div>
    </PageTransition>
  );
}
