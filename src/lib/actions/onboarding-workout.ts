"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/providers";
import { generateOnboardingWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import { formatUserError } from "@/lib/format-user-error";
import {
  STARTER_PROGRAM_WEEKS,
  daysPerWeekFromIntake,
  weekdaysForSessionCount,
} from "@/lib/intake-starter-program";
import { profileToResponses } from "@/lib/intake-questionnaire";
import { generateRecurringScheduleDates } from "@/lib/schedule-utils";
import type { Profile } from "@/lib/types";

export type StarterProgramResult =
  | {
      built: true;
      planId: string;
      title: string;
      daysPerWeek: number;
      sessionsScheduled: number;
    }
  | { built: false; skipped: true; reason: string }
  | { built: false; error: string };

async function clientAlreadyHasWorkoutProgram(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<boolean> {
  const { data: assignment } = await admin
    .from("workout_assignments")
    .select("id")
    .eq("client_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (assignment) return true;

  const { data: personal } = await admin
    .from("workout_plans")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .limit(1)
    .maybeSingle();
  return !!personal;
}

/**
 * After first questionnaire completion: generate a personalized weekly strength
 * plan, assign it, and schedule each day across 4 weeks.
 */
export async function buildStarterWorkoutProgramForUser(
  userId: string,
  profile: Profile
): Promise<StarterProgramResult> {
  if (!isAiConfigured()) {
    return { built: false, skipped: true, reason: "ai_not_configured" };
  }

  const admin = createAdminClient();

  if (await clientAlreadyHasWorkoutProgram(admin, userId)) {
    return { built: false, skipped: true, reason: "already_has_program" };
  }

  try {
    const plan = await generateOnboardingWorkoutPlanFromProfile(profile);
    const responses = profileToResponses(profile);
    const daysPerWeek = Math.min(
      plan.days.length,
      daysPerWeekFromIntake(responses)
    );
    const days = plan.days.slice(0, daysPerWeek);
    if (days.length === 0) {
      return { built: false, error: "AI did not return workout days" };
    }

    const { data: created, error: createError } = await admin
      .from("workout_plans")
      .insert({
        title: plan.title,
        description:
          plan.description ||
          `4-week starter · ${days.length} days/week from your health profile`,
        created_by: userId,
        is_personal: true,
        kind: "strength",
      })
      .select("id")
      .single();

    if (createError || !created) {
      return {
        built: false,
        error: createError?.message ?? "Could not create workout plan",
      };
    }

    const planId = created.id as string;
    const dayIds: string[] = [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const { data: dayRow, error: dayError } = await admin
        .from("workout_days")
        .insert({ plan_id: planId, day_index: i, title: day.title })
        .select("id")
        .single();

      if (dayError || !dayRow) {
        return {
          built: false,
          error: dayError?.message ?? "Could not create workout day",
        };
      }

      dayIds.push(dayRow.id as string);

      if (day.exercises.length > 0) {
        const enriched = day.exercises.map((ex) =>
          enrichExerciseWithGif({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            image_url: ex.image_url,
            video_url: ex.video_url,
          })
        );
        const { error: exError } = await admin.from("exercises").insert(
          enriched.map((ex, orderIndex) => ({
            day_id: dayRow.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes ?? null,
            image_url: ex.image_url ?? null,
            video_url: ex.video_url ?? null,
            order_index: orderIndex,
          }))
        );
        if (exError) return { built: false, error: exError.message };
      }
    }

    await admin
      .from("workout_assignments")
      .update({ active: false })
      .eq("client_id", userId);

    const { error: assignError } = await admin.from("workout_assignments").insert({
      client_id: userId,
      plan_id: planId,
      active: true,
    });
    if (assignError) return { built: false, error: assignError.message };

    const weekdays = weekdaysForSessionCount(dayIds.length);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const startKey = format(today, "yyyy-MM-dd");
    let sessionsScheduled = 0;

    for (let i = 0; i < dayIds.length; i++) {
      const weekday = weekdays[i] ?? weekdays[weekdays.length - 1]!;
      const dates = generateRecurringScheduleDates(
        today,
        [weekday],
        STARTER_PROGRAM_WEEKS
      );

      for (const scheduledDate of dates) {
        if (scheduledDate < startKey) continue;

        const { data: existing } = await admin
          .from("scheduled_workouts")
          .select("id")
          .eq("client_id", userId)
          .eq("scheduled_date", scheduledDate)
          .eq("plan_id", planId)
          .eq("day_id", dayIds[i])
          .maybeSingle();
        if (existing) continue;

        const { data: siblings } = await admin
          .from("scheduled_workouts")
          .select("order_index")
          .eq("client_id", userId)
          .eq("scheduled_date", scheduledDate)
          .order("order_index", { ascending: false })
          .limit(1);

        const orderIndex = (siblings?.[0]?.order_index ?? -1) + 1;
        const { error: insertError } = await admin
          .from("scheduled_workouts")
          .insert({
            client_id: userId,
            scheduled_date: scheduledDate,
            plan_id: planId,
            day_id: dayIds[i],
            order_index: orderIndex,
          });
        if (insertError) return { built: false, error: insertError.message };
        sessionsScheduled += 1;
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    revalidatePath(`/dashboard/workout/${planId}`);
    revalidatePath(`/dashboard/workout/${planId}/edit`);

    return {
      built: true,
      planId,
      title: plan.title,
      daysPerWeek: dayIds.length,
      sessionsScheduled,
    };
  } catch (error) {
    console.error("[buildStarterWorkoutProgramForUser]", error);
    return {
      built: false,
      error: formatUserError(error, "Could not build your starter workout program"),
    };
  }
}
