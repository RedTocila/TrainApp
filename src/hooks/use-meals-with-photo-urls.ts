"use client";

import { useEffect, useMemo, useState } from "react";
import { getSignedMealPhotoUrls } from "@/lib/actions/meal-photos";
import { hasActiveMealPhoto } from "@/lib/meal-photo-utils";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import type { DailyMealLog } from "@/lib/types";

function mealPhotoKey(meals: DailyMealLog[]): string {
  return meals
    .map((meal) => `${meal.id}:${meal.photo_path ?? ""}:${meal.photo_expires_at ?? ""}`)
    .join("|");
}

/**
 * Resolve signed meal photo URLs via the server (service role).
 * Browser storage signing is unreliable for private meal-photos.
 */
export function useMealsWithPhotoUrls(
  clientId: string,
  meals: DailyMealLog[]
): DailyMealLog[] {
  const [urlsById, setUrlsById] = useState<Record<string, string>>({});
  const photoKey = useMemo(() => mealPhotoKey(meals), [meals]);

  useEffect(() => {
    let cancelled = false;
    const withPhotos = meals.filter((meal) => hasActiveMealPhoto(meal));
    if (withPhotos.length === 0) {
      setUrlsById({});
      return;
    }

    void runServerAction(() => getSignedMealPhotoUrls(clientId, withPhotos)).then(
      (result) => {
        if (cancelled || isActionError(result)) return;
        setUrlsById(result);
      }
    );

    return () => {
      cancelled = true;
    };
    // photoKey captures photo identity; meals listed for lint completeness
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, photoKey]);

  return useMemo(
    () =>
      meals.map((meal) => ({
        ...meal,
        photo_url: hasActiveMealPhoto(meal)
          ? urlsById[meal.id] ?? null
          : null,
      })),
    [meals, urlsById]
  );
}
