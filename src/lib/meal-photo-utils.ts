import { addDays } from "date-fns";

export const MEAL_PHOTO_RETENTION_DAYS = 30;

const ALLOWED_MEAL_PHOTO_MIME = new Set(["image/jpeg", "image/webp"]);

export function mealPhotoExpiresAt(from: Date = new Date()): string {
  return addDays(from, MEAL_PHOTO_RETENTION_DAYS).toISOString();
}

export function isMealPhotoExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) <= now;
}

export function mealPhotoStoragePath(
  clientId: string,
  logId: string,
  extension: "webp" | "jpg"
): string {
  return `${clientId}/${logId}.${extension}`;
}

export function mealPhotoExtensionForMime(mimeType: string): "webp" | "jpg" | null {
  if (!ALLOWED_MEAL_PHOTO_MIME.has(mimeType)) return null;
  return mimeType === "image/webp" ? "webp" : "jpg";
}

export function hasActiveMealPhoto(meal: {
  photo_path?: string | null;
  photo_expires_at?: string | null;
}): boolean {
  return Boolean(meal.photo_path && !isMealPhotoExpired(meal.photo_expires_at));
}
