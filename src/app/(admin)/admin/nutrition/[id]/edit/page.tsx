import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getNutritionPlanWithDetails } from "@/lib/actions/plans";
import { NutritionBuilder } from "@/components/nutrition-builder";
import { PageTransition } from "@/components/page-transition";

export default async function EditNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { plan, meals } = await getNutritionPlanWithDetails(id);

  if (!plan) notFound();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Edit Nutrition Plan</h1>
          <p className="text-muted-foreground">{plan.title}</p>
        </div>
        <NutritionBuilder
          planId={plan.id}
          initialTitle={plan.title}
          initialDescription={plan.description ?? ""}
          initialMacros={{
            target_calories: plan.target_calories,
            target_protein: plan.target_protein,
            target_carbs: plan.target_carbs,
            target_fat: plan.target_fat,
          }}
          initialMeals={meals.map((m) => ({
            id: m.id,
            meal_type: m.meal_type,
            name: m.name,
            description: m.description,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            foods: m.foods ?? [],
          }))}
        />
      </div>
    </PageTransition>
  );
}
