"use client";

import { useEffect, useState } from "react";
import { attachMealPhotoUrls } from "@/lib/meal-photo-urls";
import type { DailyMealLog } from "@/lib/types";

export function useMealsWithPhotoUrls(meals: DailyMealLog[]): DailyMealLog[] {
  const [resolved, setResolved] = useState(meals);

  useEffect(() => {
    let cancelled = false;
    void attachMealPhotoUrls(meals).then((next) => {
      if (!cancelled) setResolved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [meals]);

  return resolved;
}
