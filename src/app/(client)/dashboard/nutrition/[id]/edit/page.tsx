import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFoldersForMove,
  getPersonalMealsLibrary,
  getPersonalNutritionPlanWithDetails,
} from "@/lib/actions/user-nutrition";
import { getNutritionScheduleForPlan } from "@/lib/actions/user-nutrition-schedule";
import { EditNutritionClient } from "@/components/edit-nutrition-client";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function EditNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const [{ plan, meals }, folders, mealLibrary, scheduledDates] = await Promise.all([
    getPersonalNutritionPlanWithDetails(id),
    getNutritionFoldersForMove(),
    getPersonalMealsLibrary(),
    getNutritionScheduleForPlan(id),
  ]);

  if (!plan) notFound();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={
              plan.folder_id
                ? `/dashboard/nutrition/folder/${plan.folder_id}`
                : "/dashboard/nutrition/folder/uncategorized"
            }
          >
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">Edit day menu</h1>
            <p className="text-sm text-muted-foreground">{plan.title}</p>
          </div>
        </div>
        <EditNutritionClient
          plan={plan}
          meals={meals}
          folders={folders}
          mealLibrary={mealLibrary}
          scheduledDates={scheduledDates}
        />
      </div>
    </PageTransition>
  );
}
