import { requireClient } from "@/lib/actions/auth";
import { getClientNutritionAssignment } from "@/lib/actions/plans";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function NutritionPage() {
  const profile = await requireClient();
  const assignment = await getClientNutritionAssignment(profile.id);
  const plan = assignment?.nutrition_plans;
  const meals = plan?.meals?.sort(
    (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
  ) ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Nutrition Plan</h1>
          <p className="text-muted-foreground">
            {plan ? plan.title : "No nutrition plan assigned yet"}
          </p>
        </div>

        {plan ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Calories", value: plan.target_calories },
                { label: "Protein", value: `${plan.target_protein}g` },
                { label: "Carbs", value: `${plan.target_carbs}g` },
                { label: "Fat", value: `${plan.target_fat}g` },
              ].map((macro) => (
                <Card key={macro.label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">{macro.label}</p>
                    <p className="text-xl font-bold text-primary">{macro.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {meals.map((meal: { id: string; meal_type: string; name: string; foods: { name: string; amount?: string }[] }) => (
              <Card key={meal.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">{meal.meal_type}</Badge>
                    <CardTitle className="text-base">{meal.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {meal.foods?.map((food, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span>{food.name}</span>
                        {food.amount && (
                          <span className="text-muted-foreground">{food.amount}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Apply for a diet plan from your dashboard to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
