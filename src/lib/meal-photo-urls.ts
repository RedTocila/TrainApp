import {
  createSignedStorageUrl,
  STORAGE_BUCKETS,
} from "@/lib/supabase/storage";
import type { DailyMealLog } from "@/lib/types";
import { hasActiveMealPhoto } from "@/lib/meal-photo-utils";

/** Resolve signed storage URLs in the browser (parallel, no server round-trip). */
export async function resolveMealPhotoUrl(
  photoPath: string | null | undefined
): Promise<string | null> {
  if (!photoPath) return null;
  try {
    return await createSignedStorageUrl(STORAGE_BUCKETS.mealPhotos, photoPath);
  } catch {
    return null;
  }
}

export async function attachMealPhotoUrls<T extends DailyMealLog>(
  meals: T[]
): Promise<T[]> {
  return Promise.all(
    meals.map(async (meal) => {
      if (!hasActiveMealPhoto(meal)) {
        return { ...meal, photo_url: null };
      }
      const photo_url = await resolveMealPhotoUrl(meal.photo_path);
      return { ...meal, photo_url };
    })
  );
}
