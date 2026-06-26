"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  formatDbError,
  requireOwnedClient,
  requireSubscribedMutationAdmin,
} from "@/lib/actions/auth-client";
import type { ProgressPhotoPose, ProgressPhotoSet } from "@/lib/types";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

const POSE_COLUMNS: Record<ProgressPhotoPose, keyof Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">> = {
  front: "front_path",
  back: "back_path",
  side: "side_path",
};

export async function getProgressPhotoSets(
  clientId: string,
  limit = 12
): Promise<ProgressPhotoSet[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_photo_sets")
    .select("id, client_id, month_key, front_path, back_path, side_path, created_at, updated_at")
    .eq("client_id", clientId)
    .order("month_key", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getProgressPhotoSetForMonth(
  clientId: string,
  monthKey: string
): Promise<ProgressPhotoSet | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_photo_sets")
    .select("id, client_id, month_key, front_path, back_path, side_path, created_at, updated_at")
    .eq("client_id", clientId)
    .eq("month_key", monthKey)
    .maybeSingle();
  return data;
}

export async function saveProgressPhotoPath(
  clientId: string,
  monthKey: string,
  pose: ProgressPhotoPose,
  storagePath: string
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const column = POSE_COLUMNS[pose];
  const existing = await getProgressPhotoSetForMonth(clientId, monthKey);
  const { admin } = mutation;

  if (existing) {
    const { error } = await admin
      .from("progress_photo_sets")
      .update({
        [column]: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: formatDbError(error.message) };
  } else {
    const { error } = await admin.from("progress_photo_sets").insert({
      client_id: clientId,
      month_key: monthKey,
      [column]: storagePath,
    });
    if (error) return { error: formatDbError(error.message) };
  }

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function removeProgressPhotoPath(
  clientId: string,
  monthKey: string,
  pose: ProgressPhotoPose
) {
  const mutation = await requireSubscribedMutationAdmin(clientId);
  if ("error" in mutation) return { error: mutation.error };

  const existing = await getProgressPhotoSetForMonth(clientId, monthKey);
  if (!existing) return { success: true as const };

  const column = POSE_COLUMNS[pose];
  const storagePath = existing[column];
  const { admin } = mutation;

  const { error } = await admin
    .from("progress_photo_sets")
    .update({
      [column]: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) return { error: formatDbError(error.message) };

  if (storagePath) {
    await admin.storage.from(STORAGE_BUCKETS.progressPhotos).remove([storagePath]);
  }

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function getSignedProgressPhotoUrls(
  clientId: string,
  set: ProgressPhotoSet
): Promise<Record<ProgressPhotoPose, string | null>> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) {
    return { front: null, back: null, side: null };
  }

  const paths: Record<ProgressPhotoPose, string | null> = {
    front: set.front_path,
    back: set.back_path,
    side: set.side_path,
  };

  const urls: Record<ProgressPhotoPose, string | null> = {
    front: null,
    back: null,
    side: null,
  };

  await Promise.all(
    (Object.keys(paths) as ProgressPhotoPose[]).map(async (pose) => {
      const path = paths[pose];
      if (!path) return;
      const { data, error } = await auth.admin.storage
        .from(STORAGE_BUCKETS.progressPhotos)
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) {
        urls[pose] = data.signedUrl;
      }
    })
  );

  return urls;
}
