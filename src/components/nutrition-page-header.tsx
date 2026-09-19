"use client";

import { BuildNutritionButton } from "@/components/build-nutrition-button";
import { ProgramsPageHeader } from "@/components/programs/programs-page-header";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";

export function NutritionPageHeader({ title }: { title: string }) {
  return (
    <ProgramsPageHeader
      title={title}
      tabs={<NutritionSectionTabs />}
      actions={<BuildNutritionButton />}
    />
  );
}
