import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDbError } from "@/lib/actions/auth-client";
import {
  isMealPhotoExpired,
  mealPhotoExpiresAt,
  mealPhotoExtensionForMime,
  mealPhotoStoragePath,
} from "@/lib/meal-photo-utils";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import type { DailyMealLog } from "@/lib/types";

export const MEAL_LOG_PHOTO_COLUMNS =
  "id, client_id, date, slot, meal_type, name, description, calories, protein, carbs, fat, foods, source_meal_id, logged_at, photo_path, photo_expires_at";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type MealPhotoUploadInput = {
  base64: string;
  mimeType: string;
};

export async function uploadMealPhotoBuffer(
  admin: SupabaseClient,
  clientId: string,
  logId: string,
  input: MealPhotoUploadInput
): Promise<{ path: string; expiresAt: string } | { error: string }> {
  const extension = mealPhotoExtensionForMime(input.mimeType);
  if (!extension) {
    return { error: "Unsupported image type. Use JPEG or WebP." };
  }

  const sizeBytes = Math.ceil((input.base64.length * 3) / 4);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Please use a photo under 2 MB." };
  }

  const buffer = Buffer.from(input.base64, "base64");
  const path = mealPhotoStoragePath(clientId, logId, extension);
  const expiresAt = mealPhotoExpiresAt();

  const { error } = await admin.storage.from(STORAGE_BUCKETS.mealPhotos).upload(path, buffer, {
    upsert: true,
    cacheControl: "2592000",
    contentType: input.mimeType,
  });

  if (error) return { error: formatDbError(error.message) };

  return { path, expiresAt };
}

export async function removeMealPhotoStorage(
  admin: SupabaseClient,
  photoPath: string | null | undefined
) {
  if (!photoPath) return;
  await admin.storage.from(STORAGE_BUCKETS.mealPhotos).remove([photoPath]);
}

export function sanitizeMealLogRow<T extends DailyMealLog>(meal: T): T {
  if (!meal.photo_path) return meal;
  if (isMealPhotoExpired(meal.photo_expires_at)) {
    return { ...meal, photo_path: null, photo_expires_at: null, photo_url: null };
  }
  return meal;
}
