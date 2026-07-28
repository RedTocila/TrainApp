"use server";

import { findCatalogExercise } from "@/lib/exercise-catalog";
import type { HiitConfig } from "@/lib/hiit";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the admin-connected YouTube demo for an exercise name
 * (catalog match → exercise_video_overrides).
 */
export async function resolveExerciseYoutubeUrl(
  exerciseName: string
): Promise<string | null> {
  const catalog = findCatalogExercise(exerciseName);
  if (!catalog) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_video_overrides")
    .select("youtube_url")
    .eq("catalog_exercise_id", catalog.id)
    .maybeSingle();

  const url = data?.youtube_url?.trim();
  return url || null;
}

/** Batch-resolve admin YouTube demos for many exercise names. */
export async function resolveExerciseYoutubeUrlsByNames(
  names: string[]
): Promise<Record<string, string>> {
  const uniqueNames = [
    ...new Set(names.map((n) => n.trim()).filter(Boolean)),
  ];
  if (uniqueNames.length === 0) return {};

  const nameToCatalogId = new Map<string, string>();
  const catalogIds: string[] = [];
  for (const name of uniqueNames) {
    const catalog = findCatalogExercise(name);
    if (!catalog) continue;
    nameToCatalogId.set(name, catalog.id);
    catalogIds.push(catalog.id);
  }

  if (catalogIds.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_video_overrides")
    .select("catalog_exercise_id, youtube_url")
    .in("catalog_exercise_id", [...new Set(catalogIds)]);

  const byCatalogId = new Map(
    (data ?? [])
      .filter((row) => row.youtube_url?.trim())
      .map((row) => [
        row.catalog_exercise_id as string,
        row.youtube_url as string,
      ])
  );

  const result: Record<string, string> = {};
  for (const [name, catalogId] of nameToCatalogId) {
    const url = byCatalogId.get(catalogId);
    if (url) result[name] = url;
  }
  return result;
}

/** Attach admin YouTube URLs onto HIIT / interval exercise configs. */
export async function enrichHiitConfigWithYoutube(
  config: HiitConfig
): Promise<HiitConfig> {
  const names = config.exercises
    .filter((ex) => ex.name.trim() && !ex.video_url?.trim())
    .map((ex) => ex.name);
  if (names.length === 0) return config;

  const overrides = await resolveExerciseYoutubeUrlsByNames(names);
  if (Object.keys(overrides).length === 0) return config;

  return {
    ...config,
    exercises: config.exercises.map((ex) => {
      const youtube = overrides[ex.name.trim()];
      if (!youtube || ex.video_url?.trim()) return ex;
      return { ...ex, video_url: youtube };
    }),
  };
}
