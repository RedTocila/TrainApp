"use server";

import { requireAdmin } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXERCISE_CATALOG } from "@/lib/exercise-catalog";
import { isValidYoutubeUrl } from "@/lib/youtube";

export type AdminExerciseRow = {
  id: string;
  name: string;
  category: string;
  body_parts: string[];
  equipment: string[];
  /** YouTube URL that has been saved by admin, or null. */
  youtube_url: string | null;
};

/** All DB overrides keyed by catalog_exercise_id. */
async function fetchVideoOverrides(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("exercise_video_overrides")
    .select("catalog_exercise_id, youtube_url");
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.catalog_exercise_id] = row.youtube_url;
  }
  return map;
}

export async function getAdminExercises(opts?: {
  search?: string;
  category?: string;
  withVideoOnly?: boolean;
}): Promise<{ exercises: AdminExerciseRow[]; categories: string[] }> {
  await requireAdmin();

  const overrides = await fetchVideoOverrides();
  const categories = EXERCISE_CATALOG.categories;

  let exercises = EXERCISE_CATALOG.exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    category: ex.category,
    body_parts: ex.body_parts,
    equipment: ex.equipment,
    youtube_url: overrides[ex.id] ?? ex.video_url ?? null,
  }));

  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    exercises = exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.body_parts.some((b) => b.toLowerCase().includes(q))
    );
  }

  if (opts?.category?.trim()) {
    const cat = opts.category.trim();
    exercises = exercises.filter((ex) => ex.category === cat);
  }

  if (opts?.withVideoOnly) {
    exercises = exercises.filter((ex) => Boolean(ex.youtube_url));
  }

  return { exercises, categories };
}

export async function saveExerciseVideoUrl(
  catalogExerciseId: string,
  youtubeUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const url = youtubeUrl.trim();

  if (url && !isValidYoutubeUrl(url)) {
    return { ok: false, error: "Invalid YouTube URL." };
  }

  const admin = createAdminClient();

  if (!url) {
    // Remove override — fall back to catalog default (if any).
    await admin
      .from("exercise_video_overrides")
      .delete()
      .eq("catalog_exercise_id", catalogExerciseId);
    return { ok: true };
  }

  const { error } = await admin
    .from("exercise_video_overrides")
    .upsert(
      {
        catalog_exercise_id: catalogExerciseId,
        youtube_url: url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "catalog_exercise_id" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Called from the client exercise player to get the admin-set video URL for a catalog exercise. */
export async function getExerciseVideoOverride(
  catalogExerciseId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("exercise_video_overrides")
    .select("youtube_url")
    .eq("catalog_exercise_id", catalogExerciseId)
    .maybeSingle();
  return data?.youtube_url ?? null;
}
