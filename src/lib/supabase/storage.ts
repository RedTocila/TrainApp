import { createClient } from "@/lib/supabase/client";

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  blogImages: "blog-images",
  exerciseMedia: "exercise-media",
  progressPhotos: "progress-photos",
  mealPhotos: "meal-photos",
  nutritionPlanPdfs: "nutrition-plan-pdfs",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export function getPublicUrl(bucket: StorageBucket, path: string) {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File
) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (error) throw error;
  return getPublicUrl(bucket, data.path);
}

export function avatarPath(userId: string, filename: string) {
  return `${userId}/${filename}`;
}

export function blogImagePath(slug: string, filename: string) {
  return `${slug}/${filename}`;
}

export function exerciseMediaPath(exerciseId: string, filename: string) {
  return `${exerciseId}/${filename}`;
}

export type ProgressPhotoPose = "front" | "back" | "side";

export function progressPhotoPath(
  userId: string,
  monthFolder: string,
  pose: ProgressPhotoPose,
  extension: "webp" | "jpg"
) {
  return `${userId}/${monthFolder}/${pose}.${extension}`;
}

export function nutritionPlanPdfPath(clientId: string, requestId: string) {
  return `${clientId}/${requestId}/plan.pdf`;
}

export async function createSignedStorageUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600
) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
