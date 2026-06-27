"use client";

import type { ReactNode } from "react";
import { AiBuildPlanButton } from "@/components/ai-build-plan-button";
import { ProgramsPageHeader } from "@/components/programs/programs-page-header";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";

export function NutritionPageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <ProgramsPageHeader
      title={title}
      tabs={<NutritionSectionTabs />}
      actions={
        <>
          <AiBuildPlanButton type="nutrition" iconOnly />
          {action}
        </>
      }
    />
  );
}
