"use server";

import { ensureManualPlanCreation } from "@/lib/actions/usage-limits";
import { getPersonalWeekPlans } from "@/lib/actions/user-workouts";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import { normalizeHiitConfig } from "@/lib/hiit";
import type { WeekPlanConfig } from "@/lib/week-plan";

const EXAMPLE_WEEK_TITLE = "Hypertrophy · 4-day gym";
const EXAMPLE_WORKOUT_TITLE = "Hypertrophy · 4-day gym";
const EXAMPLE_MARKER = "Example week plan · hypertrophy 4-day gym split";

/** Leftover titles from the earlier (wrong) per-day seed. */
const LEGACY_DAY_TITLES = [
  "Push · Chest / Shoulders / Triceps",
  "Pull · Back / Biceps",
  "Legs · Quads / Hamstrings / Glutes",
  "Upper · Chest / Back / Arms",
];

type StrengthDay = {
  focus: string;
  weekday: number;
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
  }[];
};

const DAYS: StrengthDay[] = [
  {
    focus: "Push",
    weekday: 1,
    exercises: [
      { name: "Barbell Bench Press", sets: 4, reps: "6-8", rest_seconds: 120 },
      { name: "Incline Dumbbell Press", sets: 3, reps: "8-10", rest_seconds: 90 },
      { name: "Seated Dumbbell Shoulder Press", sets: 3, reps: "8-10", rest_seconds: 90 },
      { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rest_seconds: 60 },
      { name: "Rope Tricep Pushdown", sets: 3, reps: "10-12", rest_seconds: 60 },
      { name: "Overhead Dumbbell Tricep Extension", sets: 2, reps: "12-15", rest_seconds: 60 },
    ],
  },
  {
    focus: "Pull",
    weekday: 2,
    exercises: [
      {
        name: "Pull-Up",
        sets: 4,
        reps: "6-10",
        rest_seconds: 120,
        notes: "Assisted if needed",
      },
      { name: "Barbell Bent-Over Row", sets: 4, reps: "6-8", rest_seconds: 120 },
      { name: "Seated Cable Row", sets: 3, reps: "8-10", rest_seconds: 90 },
      { name: "Dumbbell Rear Delt Fly", sets: 3, reps: "12-15", rest_seconds: 60 },
      { name: "EZ-Bar Curl", sets: 3, reps: "10-12", rest_seconds: 60 },
      { name: "Hammer Curl", sets: 2, reps: "12-15", rest_seconds: 60 },
    ],
  },
  {
    focus: "Legs",
    weekday: 4,
    exercises: [
      { name: "Barbell Back Squat", sets: 4, reps: "6-8", rest_seconds: 150 },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", rest_seconds: 120 },
      { name: "Leg Press", sets: 3, reps: "10-12", rest_seconds: 90 },
      { name: "Walking Dumbbell Lunge", sets: 3, reps: "10/leg", rest_seconds: 90 },
      { name: "Lying Leg Curl", sets: 3, reps: "10-12", rest_seconds: 60 },
      { name: "Standing Calf Raise", sets: 3, reps: "12-15", rest_seconds: 60 },
    ],
  },
  {
    focus: "Upper",
    weekday: 5,
    exercises: [
      { name: "Dumbbell Bench Press", sets: 3, reps: "8-10", rest_seconds: 90 },
      { name: "Lat Pulldown", sets: 3, reps: "8-10", rest_seconds: 90 },
      { name: "Machine Chest Fly", sets: 3, reps: "12-15", rest_seconds: 60 },
      { name: "Chest-Supported Row", sets: 3, reps: "10-12", rest_seconds: 90 },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "12-15", rest_seconds: 60 },
      { name: "Cable Face Pull", sets: 2, reps: "12-15", rest_seconds: 60 },
    ],
  },
];

async function insertIntervalExtra(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  input: {
    title: string;
    description: string;
    kind: "warmup" | "stretch";
    config: {
      prepare_seconds: number;
      rounds: number;
      round_rest_seconds: number;
      cycles: number;
      cycle_rest_seconds: number;
      exercises: { name: string; work_seconds: number; rest_seconds: number }[];
    };
  }
): Promise<{ id: string; dayId: string } | { error: string }> {
  const config = normalizeHiitConfig(input.config);
  if (!config) return { error: `Invalid ${input.kind} config` };

  const { data: plan, error: planError } = await admin
    .from("workout_plans")
    .insert({
      title: input.title,
      description: input.description,
      created_by: userId,
      is_personal: true,
      folder_id: null,
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
      title: input.kind === "warmup" ? "Warm-up" : "Stretching",
    })
    .select("id")
    .single();
  if (dayError || !day) {
    await admin.from("workout_plans").delete().eq("id", plan.id);
    return { error: dayError?.message ?? `Could not create ${input.kind} day` };
  }

  return { id: plan.id as string, dayId: day.id as string };
}

/**
 * Removes empty per-day shells left by the first example seed.
 * Safe to call from a Server Component (no revalidatePath).
 */
export async function cleanupBrokenExampleDayWorkouts(): Promise<number> {
  const access = await ensureManualPlanCreation();
  if ("error" in access) return 0;
  const { admin, userId } = access;

  const { data: legacy } = await admin
    .from("workout_plans")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .in("title", LEGACY_DAY_TITLES);

  const { data: byDesc } = await admin
    .from("workout_plans")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .eq("kind", "strength")
    .like("description", "Hypertrophy · gym ·%");

  const ids = [
    ...new Set([
      ...(legacy ?? []).map((row) => row.id as string),
      ...(byDesc ?? []).map((row) => row.id as string),
    ]),
  ];
  if (ids.length === 0) return 0;

  await admin.from("workout_plans").delete().in("id", ids);
  return ids.length;
}

/**
 * Idempotent developer sample: one multi-day workout (Workouts) + week plan (Plans).
 * Uses direct admin writes — safe during RSC render (no revalidatePath).
 */
export async function ensureExampleHypertrophyWeekPlan(): Promise<
  | { created: true; weekPlanId: string; workoutPlanId: string }
  | { created: false; weekPlanId: string | null }
  | { error: string }
> {
  const existing = await getPersonalWeekPlans();
  const found = existing.find((p) => p.title === EXAMPLE_WEEK_TITLE);
  if (found) return { created: false, weekPlanId: found.id };

  const access = await ensureManualPlanCreation();
  if ("error" in access) return { error: access.error };
  const { admin, userId } = access;

  await cleanupBrokenExampleDayWorkouts();

  const warmup = await insertIntervalExtra(admin, userId, {
    title: "Gym warm-up",
    description: "Shared warm-up for hypertrophy week",
    kind: "warmup",
    config: {
      prepare_seconds: 5,
      rounds: 1,
      round_rest_seconds: 0,
      cycles: 1,
      cycle_rest_seconds: 0,
      exercises: [
        { name: "Jumping Jacks", work_seconds: 40, rest_seconds: 20 },
        { name: "Arm Circles", work_seconds: 30, rest_seconds: 15 },
        { name: "Bodyweight Squats", work_seconds: 40, rest_seconds: 20 },
        { name: "Band Pull-Aparts", work_seconds: 30, rest_seconds: 15 },
      ],
    },
  });
  if ("error" in warmup) return { error: warmup.error };

  const stretch = await insertIntervalExtra(admin, userId, {
    title: "Gym stretch",
    description: "Shared cool-down for hypertrophy week",
    kind: "stretch",
    config: {
      prepare_seconds: 5,
      rounds: 1,
      round_rest_seconds: 0,
      cycles: 1,
      cycle_rest_seconds: 0,
      exercises: [
        { name: "Chest Doorway Stretch", work_seconds: 40, rest_seconds: 10 },
        { name: "Lat Stretch", work_seconds: 40, rest_seconds: 10 },
        { name: "Hip Flexor Stretch", work_seconds: 40, rest_seconds: 10 },
        { name: "Hamstring Stretch", work_seconds: 40, rest_seconds: 10 },
      ],
    },
  });
  if ("error" in stretch) return { error: stretch.error };

  const { data: workoutPlan, error: workoutError } = await admin
    .from("workout_plans")
    .insert({
      title: EXAMPLE_WORKOUT_TITLE,
      description: "Gym hypertrophy · Push / Pull / Legs / Upper",
      created_by: userId,
      is_personal: true,
      folder_id: null,
      kind: "strength",
    })
    .select("id")
    .single();
  if (workoutError || !workoutPlan) {
    return { error: workoutError?.message ?? "Could not create workout" };
  }
  const workoutPlanId = workoutPlan.id as string;

  for (let i = 0; i < DAYS.length; i++) {
    const day = DAYS[i]!;
    const { data: dayRow, error: dayError } = await admin
      .from("workout_days")
      .insert({ plan_id: workoutPlanId, day_index: i, title: day.focus })
      .select("id")
      .single();
    if (dayError || !dayRow) {
      await admin.from("workout_plans").delete().eq("id", workoutPlanId);
      return { error: dayError?.message ?? `Could not create ${day.focus}` };
    }

    const enriched = day.exercises.map((ex) => enrichExerciseWithGif(ex));
    const { error: exError } = await admin.from("exercises").insert(
      enriched.map((ex, idx) => ({
        day_id: dayRow.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes ?? null,
        image_url: ("image_url" in ex ? ex.image_url : null) ?? null,
        video_url: ("video_url" in ex ? ex.video_url : null) ?? null,
        order_index: idx,
      }))
    );
    if (exError) {
      await admin.from("workout_plans").delete().eq("id", workoutPlanId);
      return { error: exError.message };
    }
  }

  const { data: existingAssignment } = await admin
    .from("workout_assignments")
    .select("id")
    .eq("client_id", userId)
    .eq("plan_id", workoutPlanId)
    .maybeSingle();
  if (!existingAssignment) {
    await admin.from("workout_assignments").insert({
      client_id: userId,
      plan_id: workoutPlanId,
    });
  }

  const { data: dayRows } = await admin
    .from("workout_days")
    .select("id, day_index")
    .eq("plan_id", workoutPlanId)
    .order("day_index");
  if (!dayRows || dayRows.length !== DAYS.length) {
    return { error: "Workout days missing after save" };
  }

  const week_config: WeekPlanConfig = {
    includeExtras: true,
    days: DAYS.map((day, i) => ({
      focus: day.focus,
      weekday: day.weekday,
      mainPlanId: workoutPlanId,
      mainDayId: dayRows[i]!.id as string,
      warmupPlanId: warmup.id,
      stretchPlanId: stretch.id,
    })),
  };

  const { data: weekPlan, error: weekError } = await admin
    .from("workout_plans")
    .insert({
      title: EXAMPLE_WEEK_TITLE,
      description: EXAMPLE_MARKER,
      created_by: userId,
      is_personal: true,
      folder_id: null,
      kind: "week",
      week_config,
    })
    .select("id")
    .single();

  if (weekError || !weekPlan) {
    return {
      error:
        weekError?.message ??
        "Could not create week plan (apply the week_plan migration if needed)",
    };
  }

  return {
    created: true,
    weekPlanId: weekPlan.id as string,
    workoutPlanId,
  };
}
