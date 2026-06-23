"use client";

import { useRouter } from "next/navigation";
import { DayMenuEditor } from "@/components/day-menu-editor";
import { NutritionScheduleForm } from "@/components/nutrition-schedule-form";
import { MoveNutritionButton } from "@/components/move-nutrition-dialog";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { Meal, NutritionPlan } from "@/lib/types";

export function EditNutritionClient({
  plan,
  meals,
  folders,
  mealLibrary,
  scheduledDates,
}: {
  plan: NutritionPlan;
  meals: Meal[];
  folders: { id: string; name: string }[];
  mealLibrary: PersonalMealLibraryItem[];
  scheduledDates: string[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <MoveNutritionButton
          planId={plan.id}
          planTitle={plan.title}
          currentFolderId={plan.folder_id}
          folders={folders}
        />
      </div>

      <NutritionScheduleForm
        planId={plan.id}
        planTitle={plan.title}
        initialDates={scheduledDates}
        onSaved={() => router.refresh()}
      />

      <DayMenuEditor
        plan={plan}
        meals={meals}
        mealLibrary={mealLibrary}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
