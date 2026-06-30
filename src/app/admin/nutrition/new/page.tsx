import { requireAdmin } from "@/lib/actions/auth";
import { NutritionBuilder } from "@/components/nutrition-builder";
import { PageTransition } from "@/components/page-transition";

export default async function NewNutritionPage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Create Nutrition Plan</h1>
          <p className="text-muted-foreground">Template plan for your library</p>
        </div>
        <NutritionBuilder />
      </div>
    </PageTransition>
  );
}
