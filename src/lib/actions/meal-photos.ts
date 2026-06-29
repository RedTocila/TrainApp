"use server";

import { revalidatePath } from "next/cache";
import {
  requireOwnedClient,
} from "@/lib/actions/auth-client";
import { hasActiveMealPhoto } from "@/lib/meal-photo-utils";
import {
  MEAL_LOG_PHOTO_COLUMNS,
  sanitizeMealLogRow,
} from "@/lib/meal-photo-storage";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import type { DailyMealLog } from "@/lib/types";

export async function getMealPhotoGallery(
  clientId: string,
  limit = 60
): Promise<DailyMealLog[]> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) return [];

  const { data, error } = await auth.admin
    .from("daily_meal_logs")
    .select(MEAL_LOG_PHOTO_COLUMNS)
    .eq("client_id", clientId)
    .not("photo_path", "is", null)
    .gt("photo_expires_at", new Date().toISOString())
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as DailyMealLog[]).map(sanitizeMealLogRow);
}

export async function getSignedMealPhotoUrls(
  clientId: string,
  meals: DailyMealLog[]
): Promise<Record<string, string>> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) return {};

  const urls: Record<string, string> = {};

  await Promise.all(
    meals.map(async (meal) => {
      if (!hasActiveMealPhoto(meal) || !meal.photo_path) return;
      const { data, error } = await auth.admin.storage
        .from(STORAGE_BUCKETS.mealPhotos)
        .createSignedUrl(meal.photo_path, 3600);
      if (!error && data?.signedUrl) {
        urls[meal.id] = data.signedUrl;
      }
    })
  );

  return urls;
}

export async function expireMealPhotos(): Promise<{ cleared: number }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: expired, error } = await admin
    .from("daily_meal_logs")
    .select("id, photo_path")
    .not("photo_path", "is", null)
    .lte("photo_expires_at", new Date().toISOString())
    .limit(500);

  if (error || !expired?.length) return { cleared: 0 };

  const paths = expired
    .map((row) => row.photo_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    await admin.storage.from(STORAGE_BUCKETS.mealPhotos).remove(paths);
  }

  const ids = expired.map((row) => row.id);
  await admin
    .from("daily_meal_logs")
    .update({ photo_path: null, photo_expires_at: null })
    .in("id", ids);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/day/nutrition");
  revalidatePath("/dashboard/meal-photos");

  return { cleared: expired.length };
}
