"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureManualPlanCreation, ensurePlanMutationAccess } from "@/lib/actions/usage-limits";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import {
  isIntervalPlan,
  normalizeHiitConfig,
  type HiitConfig,
} from "@/lib/hiit";
import { WORKOUT_PLAN_LIST_COLUMNS } from "@/lib/db-selects";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import { assignPersonalWorkoutPlan } from "@/lib/actions/user-workouts";

export async function savePersonalHiitPlan(input: {
  planId?: string;
  title: string;
  description?: string;
  folderId?: string | null;
  config: HiitConfig;
  assign?: boolean;
  /** Defaults to hiit. Warm-up / stretching also use interval config. */
  kind?: "hiit" | "warmup" | "stretch";
}) {
  const access = input.planId
    ? await ensurePlanMutationAccess()
    : await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const normalized = normalizeHiitConfig(input.config);
  if (!normalized) return { error: "Add at least one exercise with a name" };

  const { enrichHiitConfigWithYoutube } = await import(
    "@/lib/actions/exercise-videos"
  );
  const config = await enrichHiitConfigWithYoutube(normalized);

  const planKind = input.kind ?? "hiit";
  const dayTitle =
    planKind === "warmup"
      ? "Warm-up"
      : planKind === "stretch"
        ? "Stretching"
        : "HIIT";

  const resolvedFolderId =
    input.folderId && input.folderId !== UNCATEGORIZED_FOLDER_ID
      ? input.folderId
      : null;

  if (resolvedFolderId) {
    const { data: folder } = await admin
      .from("workout_folders")
      .select("id")
      .eq("id", resolvedFolderId)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  let planId = input.planId ?? null;

  if (!planId) {
    const { data, error } = await admin
      .from("workout_plans")
      .insert({
        title,
        description: input.description?.trim() || null,
        created_by: userId,
        is_personal: true,
        folder_id: resolvedFolderId,
        kind: planKind,
        hiit_config: config,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        error:
          error?.message ??
          `Failed to create ${planKind === "hiit" ? "HIIT" : planKind} plan`,
      };
    }
    planId = data.id;
  } else {
    const { data: existing } = await admin
      .from("workout_plans")
      .select("id")
      .eq("id", planId)
      .eq("created_by", userId)
      .eq("is_personal", true)
      .single();
    if (!existing) return { error: "Plan not found" };

    const { error } = await admin
      .from("workout_plans")
      .update({
        title,
        description: input.description?.trim() || null,
        kind: planKind,
        hiit_config: config,
      })
      .eq("id", planId);

    if (error) return { error: error.message };
  }

  const { data: existingDay } = await admin
    .from("workout_days")
    .select("id")
    .eq("plan_id", planId)
    .order("day_index")
    .limit(1)
    .maybeSingle();

  let dayId = existingDay?.id as string | undefined;
  if (!dayId) {
    const { data: day, error: dayError } = await admin
      .from("workout_days")
      .insert({
        plan_id: planId,
        day_index: 0,
        title: dayTitle,
      })
      .select("id")
      .single();
    if (dayError || !day) {
      return { error: dayError?.message ?? "Failed to create session day" };
    }
    dayId = day.id;
  } else {
    await admin
      .from("workout_days")
      .update({ title: dayTitle, day_index: 0 })
      .eq("id", dayId);
    await admin.from("exercises").delete().eq("day_id", dayId);
  }

  const enriched = config.exercises.map((ex) =>
    enrichExerciseWithGif({
      name: ex.name,
      sets: config.rounds,
      reps: `${ex.work_seconds}s`,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes ?? undefined,
      video_url: ex.video_url ?? undefined,
      image_url: ex.image_url ?? undefined,
    })
  );

  if (enriched.length > 0) {
    const { error: exError } = await admin.from("exercises").insert(
      enriched.map((ex, i) => ({
        day_id: dayId!,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes ?? null,
        image_url: ex.image_url ?? null,
        video_url: ex.video_url ?? null,
        order_index: i,
      }))
    );
    if (exError) return { error: exError.message };
  }

  if (input.assign !== false && !input.planId) {
    await assignPersonalWorkoutPlan(planId!);
  }

  revalidatePath("/dashboard/workout");
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  if (resolvedFolderId) {
    revalidatePath(`/dashboard/workout/folder/${resolvedFolderId}`);
  }

  return { data: { id: planId!, dayId: dayId! } };
}

export async function getPersonalHiitPlan(planId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { plan: null, config: null, dayId: null };

  const { data: plan } = await supabase
    .from("workout_plans")
    .select(WORKOUT_PLAN_LIST_COLUMNS)
    .eq("id", planId)
    .eq("created_by", user.id)
    .eq("is_personal", true)
    .single();

  if (!plan || !isIntervalPlan(plan)) {
    return { plan: null, config: null, dayId: null };
  }

  const config = normalizeHiitConfig(plan.hiit_config);
  const { data: day } = await supabase
    .from("workout_days")
    .select("id")
    .eq("plan_id", planId)
    .order("day_index")
    .limit(1)
    .maybeSingle();

  return {
    plan,
    config,
    dayId: day?.id ?? null,
  };
}
