import { createClient } from "@/lib/supabase/client";

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  blogImages: "blog-images",
  exerciseMedia: "exercise-media",
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
