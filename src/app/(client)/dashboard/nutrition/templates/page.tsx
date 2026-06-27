import { requireClient } from "@/lib/actions/auth";
import { getPersonalNutritionPlans } from "@/lib/actions/user-nutrition";
import { NutritionPageHeader } from "@/components/nutrition-page-header";
import { RecipeTemplatesPage } from "@/components/recipe-templates-page";
import { PageTransition } from "@/components/page-transition";

export default async function NutritionTemplatesPage() {
  await requireClient();
  const plans = await getPersonalNutritionPlans();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-0">
        <NutritionPageHeader title="Recipe book" />
        <RecipeTemplatesPage plans={plans} />
      </div>
    </PageTransition>
  );
}
