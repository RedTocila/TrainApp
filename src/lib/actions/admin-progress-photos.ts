"use server";

import { requireAdmin } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatProgressMonthLabel,
  progressSetComplete,
  progressSetHasPhotos,
} from "@/lib/progress-photo-utils";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import type { ProgressPhotoPose, ProgressPhotoSet } from "@/lib/types";

const POSES: ProgressPhotoPose[] = ["front", "back", "side"];

const POSE_PATHS: Record<
  ProgressPhotoPose,
  keyof Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">
> = {
  front: "front_path",
  back: "back_path",
  side: "side_path",
};

export type AdminProgressPhotoMonth = {
  monthKey: string;
  monthLabel: string;
  complete: boolean;
  urls: Record<ProgressPhotoPose, string | null>;
};

async function signPoseUrls(
  admin: ReturnType<typeof createAdminClient>,
  set: ProgressPhotoSet
): Promise<Record<ProgressPhotoPose, string | null>> {
  const urls: Record<ProgressPhotoPose, string | null> = {
    front: null,
    back: null,
    side: null,
  };

  await Promise.all(
    POSES.map(async (pose) => {
      const path = set[POSE_PATHS[pose]];
      if (!path) return;
      const { data, error } = await admin.storage
        .from(STORAGE_BUCKETS.progressPhotos)
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) {
        urls[pose] = data.signedUrl;
      }
    })
  );

  return urls;
}

export async function getAdminClientProgressPhotoGallery(
  clientId: string,
  limit = 24
): Promise<AdminProgressPhotoMonth[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: sets } = await admin
    .from("progress_photo_sets")
    .select(
      "id, client_id, month_key, front_path, back_path, side_path, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .order("month_key", { ascending: false })
    .limit(limit);

  if (!sets?.length) return [];

  const withPhotos = sets.filter(progressSetHasPhotos);
  const months = await Promise.all(
    withPhotos.map(async (set) => ({
      monthKey: set.month_key,
      monthLabel: formatProgressMonthLabel(set.month_key),
      complete: progressSetComplete(set),
      urls: await signPoseUrls(admin, set),
    }))
  );

  return months;
}
