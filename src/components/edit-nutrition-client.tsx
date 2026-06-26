"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DayMenuEditor } from "@/components/day-menu-editor";
import { NutritionScheduleForm } from "@/components/nutrition-schedule-form";
import { MoveNutritionButton } from "@/components/move-nutrition-dialog";
import {
  ProgramEditTabs,
  type ProgramEditTab,
} from "@/components/programs/program-edit-tabs";
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
  const searchParams = useSearchParams();
  const initialTab: ProgramEditTab =
    searchParams.get("tab") === "schedule" ? "schedule" : "build";
  const [tab, setTab] = useState<ProgramEditTab>(initialTab);

  const handleTabChange = (next: ProgramEditTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "schedule") url.searchParams.set("tab", "schedule");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgramEditTabs tab={tab} onTabChange={handleTabChange} />
        {folders.length > 1 && (
          <MoveNutritionButton
            planId={plan.id}
            planTitle={plan.title}
            currentFolderId={plan.folder_id}
            folders={folders}
          />
        )}
      </div>

      {tab === "build" ? (
        <DayMenuEditor
          plan={plan}
          meals={meals}
          mealLibrary={mealLibrary}
          onSaved={() => router.refresh()}
        />
      ) : (
        <NutritionScheduleForm
          planId={plan.id}
          planTitle={plan.title}
          initialDates={scheduledDates}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
