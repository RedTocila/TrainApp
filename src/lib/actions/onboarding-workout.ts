"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import { isAiConfigured } from "@/lib/ai/providers";
import { generateWeeklyFullProgramFromProfile } from "@/lib/ai/generate-weekly-full-program";
import type { AiWeeklyFullDay, AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import { normalizeHiitConfig, type WorkoutPlanKind } from "@/lib/hiit";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import {
  calculateMacrosFromIntakeResponses,
  calculateMacrosFromProfile,
} from "@/lib/macro-calculator";
import { mealTypeForSlot } from "@/lib/meal-slots";
import {
  fallbackStarterMeals,
  fallbackStarterWorkout,
} from "@/lib/starter-fallback-plans";
import { formatUserError } from "@/lib/format-user-error";
import {
  STARTER_PROGRAM_WEEKS,
  buildOnboardingProgramPreferences,
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
 * Logged-in path used by the post-signup screen. Builds the 4-week program
 * and waits until sessions are on the calendar.
 */
export async function ensureStarterWorkoutForCurrentUser(): Promise<StarterProgramResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { built: false, error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !profile) {
    return { built: false, error: error?.message ?? "Profile not found" };
  }
  if (!isClientIntakeComplete(profile as Profile)) {
    return { built: false, skipped: true, reason: "intake_incomplete" };
  }

  return buildStarterWorkoutProgramForUser(user.id, profile as Profile);
}

function mainExerciseCount(day: AiWeeklyFullDay): number {
  return day.main.kind === "hiit"
    ? day.main.plan.config.exercises.length
    : day.main.workout.exercises.length;
}

/** Reject short samples so signup falls back to a full warm-up / main / stretch day. */
function isCompleteStarterProgram(program: AiWeeklyFullProgram, daysPerWeek: number): boolean {
  if (!program.includeExtras || program.days.length < daysPerWeek) return false;
  return program.days.every(
    (day) =>
      day.warmup.config.exercises.length >= 4 &&
      day.stretch.config.exercises.length >= 4 &&
      mainExerciseCount(day) >= 6
  );
}

/**
 * After first questionnaire completion: a weekly split where every training
 * day is warm-up, a full main session, and stretching.
 */
async function starterWorkoutPlan(profile: Profile): Promise<AiWeeklyFullProgram> {
  const responses = profileToResponses(profile);
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const daysPerWeek = daysPerWeekFromIntake(responses);
  if (isAiConfigured()) {
    try {
      const generated = await generateWeeklyFullProgramFromProfile(profile, {
        daysPerWeek,
        preferences: buildOnboardingProgramPreferences(responses),
        includeExtras: true,
        completeSession: true,
      });
      if (isCompleteStarterProgram(generated, daysPerWeek)) return generated;
      console.error("[starterWorkoutPlan] AI program was too short, using starter template");
    } catch (error) {
      console.error("[starterWorkoutPlan] AI failed, using starter template", error);
    }
  }
  return fallbackStarterWorkout(responses, locale);
}

/**
 * First nutrition menu for every account, including free. Skips when one already exists.
 */
async function ensureStarterNutrition(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  profile: Profile
): Promise<void> {
  const { data: existing } = await admin
    .from("nutrition_plans")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: active } = await admin
      .from("nutrition_assignments")
      .select("id")
      .eq("client_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!active) {
      await admin.from("nutrition_assignments").insert({
        client_id: userId,
        plan_id: existing.id,
        active: true,
      });
    }
    return;
  }

  const responses = profileToResponses(profile);
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const targets =
    (profile.target_calories
      ? {
          calories: profile.target_calories,
          protein: profile.target_protein ?? 0,
          carbs: profile.target_carbs ?? 0,
          fat: profile.target_fat ?? 0,
        }
      : null) ??
    calculateMacrosFromProfile(profile) ??
    calculateMacrosFromIntakeResponses(responses);
  if (!targets || targets.calories <= 0) return;

  const meals = fallbackStarterMeals(targets, responses, locale);
  const title = locale === "al" ? "Menuja jote e parë" : "Your first menu";
  const { data: created, error } = await admin
    .from("nutrition_plans")
    .insert({
      title,
      description:
        locale === "al"
          ? "Vaktet e para, të ndara sipas objektivave të tua ditore."
          : "Your first meals, split across your daily targets.",
      created_by: userId,
      is_personal: true,
      target_calories: Math.round(targets.calories),
      target_protein: Math.round(targets.protein),
      target_carbs: Math.round(targets.carbs),
      target_fat: Math.round(targets.fat),
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[ensureStarterNutrition]", error?.message);
    return;
  }

  const { error: mealError } = await admin.from("meals").insert(
    meals.map((meal, orderIndex) => ({
      plan_id: created.id,
      slot: meal.slot,
      meal_type: mealTypeForSlot(meal.slot),
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      foods: meal.foods,
      order_index: orderIndex,
    }))
  );
  if (mealError) {
    console.error("[ensureStarterNutrition]", mealError.message);
    await admin.from("nutrition_plans").delete().eq("id", created.id);
    return;
  }

  await admin
    .from("nutrition_assignments")
    .update({ active: false })
    .eq("client_id", userId);
  const { error: assignError } = await admin.from("nutrition_assignments").insert({
    client_id: userId,
    plan_id: created.id,
    active: true,
  });
  if (assignError) console.error("[ensureStarterNutrition]", assignError.message);
  revalidatePath("/dashboard/nutrition");
}

type SavedSlot = { planId: string; dayId: string };

async function insertPersonalIntervalPlan(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  input: {
    title: string;
    description: string;
    kind: Extract<WorkoutPlanKind, "warmup" | "stretch" | "hiit">;
    config: unknown;
  }
): Promise<SavedSlot | { error: string }> {
  const config = normalizeHiitConfig(input.config);
  if (!config) return { error: `Invalid ${input.kind} session` };

  const { data: plan, error: planError } = await admin
    .from("workout_plans")
    .insert({
      title: input.title,
      description: input.description,
      created_by: userId,
      is_personal: true,
      kind: input.kind,
      hiit_config: config,
    })
    .select("id")
    .single();
  if (planError || !plan) {
    return { error: planError?.message ?? `Could not create ${input.kind}` };
  }

  const { data: day, error: dayError } = await admin
    .from("workout_days")
    .insert({
      plan_id: plan.id,
      day_index: 0,
      title: input.title,
    })
    .select("id")
    .single();
  if (dayError || !day) {
    await admin.from("workout_plans").delete().eq("id", plan.id);
    return { error: dayError?.message ?? `Could not create ${input.kind} day` };
  }

  return { planId: plan.id as string, dayId: day.id as string };
}

async function insertPersonalStrengthPlan(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  day: Extract<AiWeeklyFullDay["main"], { kind: "strength" }>["workout"]
): Promise<SavedSlot | { error: string }> {
  const title = day.title?.trim() || "Workout";
  const { data: plan, error: planError } = await admin
    .from("workout_plans")
    .insert({
      title,
      description: day.description?.trim() || "Starter main workout",
      created_by: userId,
      is_personal: true,
      kind: "strength",
    })
    .select("id")
    .single();
  if (planError || !plan) {
    return { error: planError?.message ?? "Could not create main workout" };
  }

  const { data: dayRow, error: dayError } = await admin
    .from("workout_days")
    .insert({ plan_id: plan.id, day_index: 0, title })
    .select("id")
    .single();
  if (dayError || !dayRow) {
    await admin.from("workout_plans").delete().eq("id", plan.id);
    return { error: dayError?.message ?? "Could not create workout day" };
  }

  if (day.exercises.length > 0) {
    const enriched = day.exercises.map((exercise) =>
      enrichExerciseWithGif({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        notes: exercise.notes,
        image_url: exercise.image_url,
        video_url: exercise.video_url,
      })
    );
    const { error: exError } = await admin.from("exercises").insert(
      enriched.map((exercise, orderIndex) => ({
        day_id: dayRow.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        notes: exercise.notes ?? null,
        image_url: exercise.image_url ?? null,
        video_url: exercise.video_url ?? null,
        order_index: orderIndex,
      }))
    );
    if (exError) {
      await admin.from("workout_plans").delete().eq("id", plan.id);
      return { error: exError.message };
    }
  }

  return { planId: plan.id as string, dayId: dayRow.id as string };
}

export async function buildStarterWorkoutProgramForUser(
  userId: string,
  profile: Profile
): Promise<StarterProgramResult> {
  const admin = createAdminClient();

  if (await clientAlreadyHasWorkoutProgram(admin, userId)) {
    await ensureStarterNutrition(admin, userId, profile);
    return { built: false, skipped: true, reason: "already_has_program" };
  }

  try {
    const program = await starterWorkoutPlan(profile);
    const responses = profileToResponses(profile);
    const daysPerWeek = Math.min(
      program.days.length,
      daysPerWeekFromIntake(responses)
    );
    const days = program.days.slice(0, daysPerWeek);
    if (days.length === 0) {
      return { built: false, error: "AI did not return workout days" };
    }

    const createdPlanIds: string[] = [];
    const discard = async () => {
      if (createdPlanIds.length === 0) return;
      await admin.from("workout_plans").delete().in("id", createdPlanIds);
    };
    const fail = async (error: string): Promise<StarterProgramResult> => {
      await discard();
      return { built: false, error };
    };

    type PreparedDay = {
      focus: string;
      warmup: SavedSlot;
      main: SavedSlot;
      stretch: SavedSlot;
    };
    const prepared: PreparedDay[] = [];

    for (const day of days) {
      const warmup = await insertPersonalIntervalPlan(admin, userId, {
        title: day.warmup.title,
        description: day.warmup.description?.trim() || "Warm-up",
        kind: "warmup",
        config: day.warmup.config,
      });
      if ("error" in warmup) return fail(warmup.error);
      createdPlanIds.push(warmup.planId);

      const main =
        day.main.kind === "hiit"
          ? await insertPersonalIntervalPlan(admin, userId, {
              title: day.main.plan.title,
              description: day.main.plan.description?.trim() || "Main workout",
              kind: "hiit",
              config: day.main.plan.config,
            })
          : await insertPersonalStrengthPlan(admin, userId, day.main.workout);
      if ("error" in main) return fail(main.error);
      createdPlanIds.push(main.planId);

      const stretch = await insertPersonalIntervalPlan(admin, userId, {
        title: day.stretch.title,
        description: day.stretch.description?.trim() || "Stretching",
        kind: "stretch",
        config: day.stretch.config,
      });
      if ("error" in stretch) return fail(stretch.error);
      createdPlanIds.push(stretch.planId);

      prepared.push({
        focus: day.focus || day.warmup.title,
        warmup,
        main,
        stretch,
      });
    }

    const weekdays = weekdaysForSessionCount(prepared.length);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const startKey = format(today, "yyyy-MM-dd");
    let sessionsScheduled = 0;
    let scheduledUntil = startKey;

    const scheduleSession = async (
      slot: SavedSlot,
      scheduledDate: string
    ): Promise<string | null> => {
      if (scheduledDate < startKey) return null;

      const { data: existing } = await admin
        .from("scheduled_workouts")
        .select("id")
        .eq("client_id", userId)
        .eq("scheduled_date", scheduledDate)
        .eq("plan_id", slot.planId)
        .eq("day_id", slot.dayId)
        .maybeSingle();
      if (existing) return null;

      const { data: siblings } = await admin
        .from("scheduled_workouts")
        .select("order_index")
        .eq("client_id", userId)
        .eq("scheduled_date", scheduledDate)
        .order("order_index", { ascending: false })
        .limit(1);

      const orderIndex = (siblings?.[0]?.order_index ?? -1) + 1;
      const { error: insertError } = await admin.from("scheduled_workouts").insert({
        client_id: userId,
        scheduled_date: scheduledDate,
        plan_id: slot.planId,
        day_id: slot.dayId,
        order_index: orderIndex,
      });
      if (insertError) return insertError.message;
      sessionsScheduled += 1;
      if (scheduledDate > scheduledUntil) scheduledUntil = scheduledDate;
      return null;
    };

    const scheduleDay = async (day: PreparedDay, scheduledDate: string) => {
      const warmupError = await scheduleSession(day.warmup, scheduledDate);
      if (warmupError) return warmupError;
      const mainError = await scheduleSession(day.main, scheduledDate);
      if (mainError) return mainError;
      return scheduleSession(day.stretch, scheduledDate);
    };

    // If today is not one of the split days, still put day 1 on today
    // so the program can be started as soon as the account exists.
    if (!weekdays.includes(today.getDay()) && prepared[0]) {
      const todayError = await scheduleDay(prepared[0], startKey);
      if (todayError) return fail(todayError);
    }

    for (let i = 0; i < prepared.length; i++) {
      const weekday = weekdays[i] ?? weekdays[weekdays.length - 1]!;
      const dates = generateRecurringScheduleDates(
        today,
        [weekday],
        STARTER_PROGRAM_WEEKS
      );
      for (const scheduledDate of dates) {
        const insertError = await scheduleDay(prepared[i]!, scheduledDate);
        if (insertError) return fail(insertError);
      }
    }

    const weekDays = prepared.map((day, index) => ({
      focus: day.focus,
      weekday: weekdays[index] ?? weekdays[weekdays.length - 1] ?? 1,
      mainPlanId: day.main.planId,
      mainDayId: day.main.dayId,
      warmupPlanId: day.warmup.planId,
      stretchPlanId: day.stretch.planId,
    }));
    const { data: weekPlan, error: weekError } = await admin
      .from("workout_plans")
      .insert({
        title: program.title,
        description:
          program.description ||
          `4-week program · warm-up, full workout, and stretch · ${prepared.length} days/week`,
        created_by: userId,
        is_personal: true,
        kind: "week",
        week_config: {
          includeExtras: true,
          days: weekDays,
          lastScheduledAt: new Date().toISOString(),
          scheduledUntil,
          scheduledStartDate: startKey,
          scheduledWeeks: STARTER_PROGRAM_WEEKS,
        },
      })
      .select("id")
      .single();
    if (weekError || !weekPlan) {
      return fail(weekError?.message ?? "Could not create week plan");
    }
    createdPlanIds.push(weekPlan.id as string);

    const assignedPlanId = prepared[0]!.main.planId;
    await admin
      .from("workout_assignments")
      .update({ active: false })
      .eq("client_id", userId);
    const { error: assignError } = await admin.from("workout_assignments").insert({
      client_id: userId,
      plan_id: assignedPlanId,
      active: true,
    });
    if (assignError) return fail(assignError.message);

    await ensureStarterNutrition(admin, userId, profile);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    revalidatePath("/dashboard/workout/plans");
    revalidatePath(`/dashboard/workout/${assignedPlanId}`);

    return {
      built: true,
      planId: (weekPlan.id as string) || assignedPlanId,
      title: program.title,
      daysPerWeek: prepared.length,
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
