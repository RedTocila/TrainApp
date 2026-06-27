"use client";

import { NutritionMacroRings } from "@/components/nutrition-macro-rings";
import type { MealMacros } from "@/lib/meal-utils";
import { cn } from "@/lib/utils";

export function TaskNutritionMacroPreview({
  current,
  targets,
  className,
}: {
  current: MealMacros;
  targets: MealMacros;
  className?: string;
}) {
  return (
    <NutritionMacroRings
      current={current}
      targets={targets}
      variant="compact"
      className={cn("mt-2.5", className)}
    />
  );
}
