import type { PoseUrls } from "@/lib/dashboard-route-cache";
import {
  createSignedStorageUrl,
  STORAGE_BUCKETS,
  type ProgressPhotoPose,
} from "@/lib/supabase/storage";
import type { ProgressPhotoSet } from "@/lib/types";
import { getProgressPhotoDisplaySet, normalizeMonthKey, progressSetHasPhotos } from "@/lib/progress-photo-utils";
import {
  getProgressPhotosSetsCache,
  getProgressPhotosUrlsCache,
  isProgressPhotosSetsCacheFresh,
} from "@/lib/dashboard-route-cache";

const POSES: ProgressPhotoPose[] = ["front", "back", "side"];

/** Prefer server-fetched sets when in-memory cache is empty, stale, or missing photos. */
export function resolveInitialProgressPhotoSets(
  clientId: string,
  serverSets: ProgressPhotoSet[]
): ProgressPhotoSet[] {
  const cached = getProgressPhotosSetsCache(clientId);
  if (!cached?.length) return serverSets;
  if (!isProgressPhotosSetsCacheFresh(clientId)) return serverSets;

  const serverHasPhotos = serverSets.some(progressSetHasPhotos);
  const cachedHasPhotos = cached.some(progressSetHasPhotos);
  if (serverHasPhotos && !cachedHasPhotos) return serverSets;

  return cached;
}

export function resolveInitialProgressPhotoUrls(
  clientId: string,
  serverSets: ProgressPhotoSet[],
  initialUrls?: PoseUrls
): { displaySet: ProgressPhotoSet | null; urls: PoseUrls } {
  const displaySet = getProgressPhotoDisplaySet(serverSets);
  if (!displaySet || !progressSetHasPhotos(displaySet)) {
    return { displaySet: null, urls: { front: null, back: null, side: null } };
  }

  const pathsKey = progressPhotoPathsKey(displaySet);
  const cached = getProgressPhotosUrlsCache(clientId, displaySet.month_key);
  if (
    cached &&
    cached.pathsKey === pathsKey &&
    hasPopulatedUrls(cached.urls) &&
    urlsCoverSet(cached.urls, displaySet)
  ) {
    return { displaySet, urls: cached.urls };
  }

  if (
    initialUrls &&
    hasPopulatedUrls(initialUrls) &&
    urlsCoverSet(initialUrls, displaySet)
  ) {
    return { displaySet, urls: initialUrls };
  }

  return { displaySet, urls: { front: null, back: null, side: null } };
}

export function progressPhotoPathsKey(
  set: Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">
): string {
  return `${set.front_path ?? ""}|${set.back_path ?? ""}|${set.side_path ?? ""}`;
}

export function urlsCoverSet(
  urls: PoseUrls,
  set: Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">
): boolean {
  return POSES.every((pose) => !set[`${pose}_path`] || Boolean(urls[pose]));
}

export function hasPopulatedUrls(urls: PoseUrls): boolean {
  return Boolean(urls.front || urls.back || urls.side);
}

/** Resolve signed storage URLs in the browser (parallel, no server round-trip). */
export async function resolveProgressPhotoUrls(
  set: Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">
): Promise<PoseUrls> {
  const urls: PoseUrls = { front: null, back: null, side: null };

  await Promise.all(
    POSES.map(async (pose) => {
      const path = set[`${pose}_path`];
      if (!path) return;
      try {
        urls[pose] = await createSignedStorageUrl(STORAGE_BUCKETS.progressPhotos, path);
      } catch {
        urls[pose] = null;
      }
    })
  );

  return urls;
}

export function upsertPhotoPathInSets(
  sets: ProgressPhotoSet[],
  clientId: string,
  monthKey: string,
  pose: ProgressPhotoPose,
  path: string
): ProgressPhotoSet[] {
  const column = `${pose}_path` as const;
  const now = new Date().toISOString();
  const existing = sets.find(
    (set) => normalizeMonthKey(set.month_key) === normalizeMonthKey(monthKey)
  );

  if (existing) {
    return sets.map((set) =>
      normalizeMonthKey(set.month_key) === normalizeMonthKey(monthKey)
        ? { ...set, [column]: path, updated_at: now }
        : set
    );
  }

  return [
    {
      id: `optimistic-${monthKey}`,
      client_id: clientId,
      month_key: monthKey,
      front_path: pose === "front" ? path : null,
      back_path: pose === "back" ? path : null,
      side_path: pose === "side" ? path : null,
      created_at: now,
      updated_at: now,
    },
    ...sets,
  ];
}
