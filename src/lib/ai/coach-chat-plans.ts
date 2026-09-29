import {
  getClientNutritionAssignment,
  getClientWorkoutAssignment,
} from "@/lib/actions/plans";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import { generateWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
  AiNutritionMeal,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import {
  changePortionInPlan,
  NutritionEditError,
  swapFoodInPlan,
  type NutritionEditResult,
} from "@/lib/ai/food-swap";
import { buildNutritionRequest } from "@/lib/ai/nutrition-pipeline";
import { formatNutritionPlanText } from "@/lib/ai/nutrition-quality";
import { editAllDayMenus, weeklyGroceryList } from "@/lib/ai/nutrition-day-variants";
import type { FoodLang } from "@/lib/ai/food-catalog";
import type { WorkoutPlanKind } from "@/lib/hiit";
import type { Profile } from "@/lib/types";
import {
  adaptPlanToConstraints,
  addWorkoutExercise,
  adjustWorkoutDifficulty,
  findDaysByFocus,
  removeExercisesMatching,
  removeWorkoutDay,
  removeWorkoutExercise,
  replaceWorkoutExercise,
  SurgicalEditError,
  type SurgicalEditResult,
} from "@/lib/ai/workout-surgical-edits";
import { enrichExercisesWithDemoVideos } from "@/lib/ai/exercise-video-search";
import { resolveEquipmentConstraint } from "@/lib/ai/equipment-taxonomy";
import { resolveWorkoutRequirements } from "@/lib/ai/workout-requirements";
import { familiesForExerciseName } from "@/lib/ai/exercise-semantic-match";
import {
  muscleGroupsFromMentions,
  parseDayFocusMentions,
  parseMuscleMentions,
} from "@/lib/ai/constraint-language";
import {
  applyStrengthPlanToWeekly,
  removeWeeklyProgramDays,
  weeklyToStrengthPlan,
  type CoachChatContext,
} from "@/lib/ai/coach-chat-context";
import type { AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";


type WorkoutDayRow = {
  day_index: number;
  title: string;
  exercises?: {
    order_index: number;
    name: string;
    sets?: number | null;
    reps?: string | null;
    rest_seconds?: number | null;
    notes?: string | null;
  }[];
};

type NutritionMealRow = {
  order_index: number;
  slot?: string | null;
  meal_type?: string | null;
  name: string;
  description?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  foods?: unknown;
};

function assignmentWorkoutToAiPlan(assignment: {
  workout_plans?: {
    title: string;
    description?: string | null;
    workout_days?: WorkoutDayRow[];
  } | null;
} | null): AiGeneratedWorkoutPlan | null {
  const plan = assignment?.workout_plans;
  if (!plan) return null;

  const days = (plan.workout_days ?? [])
    .sort((a, b) => a.day_index - b.day_index)
    .map((day) => ({
      title: day.title,
      exercises: (day.exercises ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => ({
          name: ex.name,
          sets: ex.sets ?? 3,
          reps: String(ex.reps ?? "10"),
          rest_seconds: ex.rest_seconds ?? 60,
          notes: ex.notes ?? undefined,
        })),
    }))
    .filter((day) => day.exercises.length > 0);

  if (days.length === 0) return null;

  return {
    kind: "strength",
    title: plan.title,
    description: plan.description ?? "",
    days_per_week: days.length,
    days,
    coach_notes: [],
  };
}

function assignmentNutritionToAiPlan(assignment: {
  nutrition_plans?: {
    title: string;
    description?: string | null;
    target_calories?: number | null;
    target_protein?: number | null;
    target_carbs?: number | null;
    target_fat?: number | null;
    meals?: NutritionMealRow[];
  } | null;
} | null): AiGeneratedNutritionPlan | null {
  const plan = assignment?.nutrition_plans;
  if (!plan) return null;

  const meals = (plan.meals ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((meal) => ({
      slot: (meal.slot ?? meal.meal_type ?? "lunch") as AiGeneratedNutritionPlan["meals"][number]["slot"],
      name: meal.name,
      description: meal.description ?? undefined,
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      ingredients: Array.isArray(meal.foods)
        ? (meal.foods as { name?: string; amount?: string }[])
            .filter((f) => f?.name)
            .map((f) => ({ name: f.name!, amount: f.amount }))
        : undefined,
    }));

  if (meals.length === 0) return null;

  return {
    title: plan.title,
    description: plan.description ?? "",
    daily_targets: {
      calories: plan.target_calories ?? 0,
      protein: plan.target_protein ?? 0,
      carbs: plan.target_carbs ?? 0,
      fat: plan.target_fat ?? 0,
    },
    meals,
    coach_notes: [],
  };
}

export async function loadActiveWorkoutPlan(clientId: string) {
  const assignment = await getClientWorkoutAssignment(clientId);
  return assignmentWorkoutToAiPlan(assignment);
}

export async function loadActiveNutritionPlan(clientId: string) {
  const assignment = await getClientNutritionAssignment(clientId);
  return assignmentNutritionToAiPlan(assignment);
}

export async function summarizeActivePlans(clientId: string): Promise<string> {
  const [workout, nutrition] = await Promise.all([
    loadActiveWorkoutPlan(clientId),
    loadActiveNutritionPlan(clientId),
  ]);

  const lines: string[] = [];

  if (workout) {
    lines.push(
      `Workout plan: "${workout.title}" — ${workout.days.length} day(s): ${workout.days.map((d) => d.title).join(", ")}`
    );
  } else {
    lines.push("Workout plan: none assigned");
  }

  if (nutrition) {
    lines.push(
      `Nutrition plan: "${nutrition.title}" — ${nutrition.daily_targets.calories} cal, P${nutrition.daily_targets.protein} C${nutrition.daily_targets.carbs} F${nutrition.daily_targets.fat}; meals: ${nutrition.meals.map((m) => `${m.slot}: ${m.name}`).join(", ")}`
    );
  } else {
    lines.push("Nutrition plan: none assigned");
  }

  return lines.join("\n");
}

function conversationOf(ctx?: CoachChatContext | null): string[] {
  return ctx?.userTurns ?? [];
}

export async function generateWorkoutPlanForChat(
  profile: Profile,
  preferences?: string,
  workoutKind?: WorkoutPlanKind | null,
  daysPerWeek?: number,
  ctx?: CoachChatContext | null
): Promise<AiWorkoutPlanResult> {
  return generateWorkoutPlanFromProfile(profile, preferences, workoutKind, {
    targetDaysPerWeek: daysPerWeek,
    conversation: conversationOf(ctx),
    hasExistingPlan: Boolean(ctx?.workingWorkout),
  });
}

export async function generateNutritionPlanForChat(
  profile: Profile,
  preferences?: string,
  ctx?: CoachChatContext | null
): Promise<AiGeneratedNutritionPlan> {
  return generateNutritionPlanFromProfile(profile, preferences, {
    conversation: conversationOf(ctx),
  });
}

/** The plan the client is looking at: latest preview in the thread, else the saved plan. */
type WorkingStrength = {
  plan: AiGeneratedWorkoutPlan;
  weekly?: { program: AiWeeklyFullProgram; view: ReturnType<typeof weeklyToStrengthPlan> };
};

async function resolveWorkingStrength(
  profile: Profile,
  ctx?: CoachChatContext | null
): Promise<WorkingStrength | null> {
  const working = ctx?.workingWorkout;
  if (working?.type === "strength") return { plan: working.plan };
  if (working?.type === "weekly_full") {
    const view = weeklyToStrengthPlan(working.program);
    if (view.plan.days.length) return { plan: view.plan, weekly: { program: working.program, view } };
  }
  const saved = await loadActiveWorkoutPlan(profile.id);
  return saved ? { plan: saved } : null;
}

export async function editWorkoutPlanForChat(
  profile: Profile,
  instructions: string,
  ctx?: CoachChatContext | null
): Promise<AiWorkoutPlanResult> {
  const working = await resolveWorkingStrength(profile, ctx);
  const current = working?.plan ?? null;
  const requirements = resolveWorkoutRequirements(profile, instructions, {
    conversation: conversationOf(ctx),
    hasExistingPlan: Boolean(current),
  });
  // Keep the day count unless the client changed it or removed day types.
  let targetDays = requirements.daysPerWeek ?? current?.days.length;
  if (current && requirements.daysPerWeek == null && requirements.excludedDayFocuses.length) {
    const removed = findDaysByFocus(current, requirements.excludedDayFocuses).length;
    targetDays = Math.max(1, current.days.length - removed);
  }
  const baseContext = current
    ? `CURRENT WORKOUT PLAN (modify this — keep everything that still fits; change only what the request asks):\n${JSON.stringify(
        { title: current.title, days: current.days },
        null,
        2
      )}`
    : "The client has no active workout plan yet — create one based on the edit request.";

  return generateWorkoutPlanFromProfile(profile, instructions.trim(), current ? "strength" : null, {
    targetDaysPerWeek: targetDays,
    conversation: conversationOf(ctx),
    hasExistingPlan: Boolean(current),
    baseContext,
  });
}

async function attachDemosToStrengthPlan(
  plan: AiGeneratedWorkoutPlan,
  profile: Profile,
  preferencesHint?: string | null
): Promise<AiGeneratedWorkoutPlan> {
  const equipment = resolveEquipmentConstraint(profile, preferencesHint);
  const days = await Promise.all(
    plan.days.map(async (day) => ({
      ...day,
      exercises: await enrichExercisesWithDemoVideos(
        day.exercises,
        profile.gender,
        equipment
      ),
    }))
  );
  return { ...plan, days };
}

function requireStrengthPlan(working: WorkingStrength | null): WorkingStrength {
  if (!working) {
    throw new SurgicalEditError(
      "no_plan",
      "No active workout plan assigned. Generate a workout plan first, then edit it."
    );
  }
  return working;
}

/** Surgical result — `weekly` is set when the working plan was a weekly program. */
export type ChatSurgicalResult = SurgicalEditResult & { weekly?: AiWeeklyFullProgram };

async function finishSurgical(
  working: WorkingStrength,
  result: SurgicalEditResult,
  profile: Profile,
  hint?: string | null
): Promise<ChatSurgicalResult> {
  const plan = await attachDemosToStrengthPlan(result.plan, profile, hint);
  if (working.weekly) {
    return {
      ...result,
      plan,
      weekly: applyStrengthPlanToWeekly(working.weekly.program, working.weekly.view, plan),
    };
  }
  return { ...result, plan };
}

export async function removeWorkoutExerciseForChat(
  profile: Profile,
  options: {
    dayNumber?: number | null;
    exerciseNumber?: number | null;
    exerciseName?: string | null;
  },
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  return finishSurgical(working, removeWorkoutExercise(working.plan, options), profile);
}

export async function removeMatchingExercisesForChat(
  profile: Profile,
  options: { exerciseNames?: string[]; muscles?: string | null; dayNumber?: number | null },
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  const names = (options.exerciseNames ?? []).map((n) => n.trim()).filter(Boolean);
  const families = [...new Set(names.flatMap((n) => familiesForExerciseName(n)))];
  const avoidGroups = options.muscles?.trim()
    ? muscleGroupsFromMentions(parseMuscleMentions(options.muscles))
    : [];
  const result = removeExercisesMatching(working.plan, {
    families,
    names,
    avoidGroups,
    dayNumber: options.dayNumber,
  });
  return finishSurgical(working, result, profile);
}

export async function removeWorkoutDayForChat(
  profile: Profile,
  options: { dayNumber?: number | null; focus?: string | null },
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const focusIds = options.focus?.trim()
    ? parseDayFocusMentions(`${options.focus} day`)
    : [];
  const working = ctx?.workingWorkout;
  if (working?.type === "weekly_full") {
    const removed = removeWeeklyProgramDays(working.program, {
      dayNumber: options.dayNumber,
      focus: focusIds,
    });
    if (!removed) {
      throw new SurgicalEditError(
        "day_not_found",
        `No matching day to remove (or it would remove every day). Days: ${working.program.days
          .map((d, i) => `${i + 1}. ${d.focus}`)
          .join("; ")}.`
      );
    }
    const view = weeklyToStrengthPlan(removed.program);
    return {
      plan: view.plan,
      weekly: removed.program,
      changes: removed.removed.map((title, i) => ({
        dayIndex: i,
        dayTitle: title,
        action: "remove_day" as const,
        detail: `Removed ${title}`,
      })),
      summary: `Removed ${removed.removed.join(" and ")}. No replacement added — the program now has ${
        removed.program.days.length
      } day(s): ${removed.program.days.map((d, i) => `${i + 1}. ${d.focus}`).join("; ")}.`,
    };
  }
  const strength = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  const result = removeWorkoutDay(strength.plan, {
    dayNumber: options.dayNumber,
    focus: focusIds,
  });
  return finishSurgical(strength, result, profile);
}

export async function adaptWorkoutToConstraintsForChat(
  profile: Profile,
  instructions: string,
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  const requirements = resolveWorkoutRequirements(profile, instructions, {
    conversation: conversationOf(ctx),
    hasExistingPlan: true,
  });
  const result = adaptPlanToConstraints(working.plan, requirements);
  return finishSurgical(working, result, profile, instructions);
}

export async function addWorkoutExerciseForChat(
  profile: Profile,
  options: {
    dayNumber?: number | null;
    exerciseName?: string | null;
    targetMuscle?: string | null;
    sets?: number | null;
    reps?: string | null;
    restSeconds?: number | null;
  },
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  const result = addWorkoutExercise(working.plan, profile, {
    ...options,
    conversation: conversationOf(ctx),
  });
  return finishSurgical(working, result, profile, options.exerciseName ?? options.targetMuscle);
}

export async function replaceWorkoutExerciseForChat(
  profile: Profile,
  options: {
    dayNumber?: number | null;
    exerciseNumber?: number | null;
    exerciseName?: string | null;
    replacementName?: string | null;
  },
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  const result = replaceWorkoutExercise(working.plan, profile, {
    ...options,
    conversation: conversationOf(ctx),
  });
  return finishSurgical(working, result, profile, options.replacementName ?? options.exerciseName);
}

export async function adjustWorkoutDifficultyForChat(
  profile: Profile,
  direction: "harder" | "easier",
  dayNumber?: number | null,
  ctx?: CoachChatContext | null
): Promise<ChatSurgicalResult> {
  const working = requireStrengthPlan(await resolveWorkingStrength(profile, ctx));
  return finishSurgical(working, adjustWorkoutDifficulty(working.plan, direction, { dayNumber }), profile);
}

export { SurgicalEditError };

export async function editNutritionPlanForChat(
  profile: Profile,
  instructions: string,
  ctx?: CoachChatContext | null
): Promise<AiGeneratedNutritionPlan> {
  const current = ctx?.workingNutrition ?? (await loadActiveNutritionPlan(profile.id));
  const baseContext = current
    ? `CURRENT NUTRITION PLAN (modify this — keep what still works unless asked to remove):\n${JSON.stringify(
        { title: current.title, daily_targets: current.daily_targets, meals: current.meals },
        null,
        2
      )}`
    : "The client has no active nutrition plan yet — create one based on the edit request.";

  return generateNutritionPlanFromProfile(profile, instructions.trim(), {
    conversation: conversationOf(ctx),
    baseContext,
  });
}

export type ChatNutritionEditResult = {
  plan: AiGeneratedNutritionPlan;
  summary: string;
  planText: string;
};

const SLOT_WORDS: [RegExp, AiNutritionMeal["slot"]][] = [
  [/\bbreakfast|mengjes\b/i, "breakfast"],
  [/\bmorning snack|first snack|snack 1\b/i, "snack_1"],
  [/\blunch|dreka\b/i, "lunch"],
  [/\bafternoon snack|second snack|snack 2\b/i, "snack_2"],
  [/\bdinner|supper|darka\b/i, "dinner"],
];

/** "breakfast" / "meal 2" / "afternoon snack" → a slot in this plan (null = anywhere). */
function resolveMealSlot(plan: AiGeneratedNutritionPlan, meal?: string | null): AiNutritionMeal["slot"] | null {
  const text = (meal ?? "").trim();
  if (!text) return null;
  const direct = plan.meals.find((m) => m.slot === text);
  if (direct) return direct.slot;
  const num = text.match(/\bmeal\s*(\d)\b/i);
  if (num) return plan.meals[Number(num[1]) - 1]?.slot ?? null;
  for (const [re, slot] of SLOT_WORDS) if (re.test(text)) return slot;
  if (/\bsnack\b/i.test(text)) {
    const snacks = plan.meals.filter((m) => m.slot === "snack_1" || m.slot === "snack_2");
    return snacks.length === 1 ? snacks[0]!.slot : null;
  }
  return null;
}

async function resolveWorkingNutrition(profile: Profile, ctx?: CoachChatContext | null) {
  const current = ctx?.workingNutrition ?? (await loadActiveNutritionPlan(profile.id));
  if (!current?.meals.length) {
    throw new NutritionEditError("The client has no nutrition plan yet — offer to build one first (generate_nutrition_plan).");
  }
  return current;
}

function finishNutritionEdit(result: NutritionEditResult, lang: FoodLang): ChatNutritionEditResult {
  const plan = { ...result.plan, grocery_list: weeklyGroceryList(result.plan, lang) };
  return { plan, summary: result.summary, planText: formatNutritionPlanText(plan) };
}

/** Swap one food (engine picks a macro-matched allowed whole food when `to` is empty). */
export async function swapFoodForChat(
  profile: Profile,
  args: { from: string; to?: string | null; meal?: string | null },
  ctx?: CoachChatContext | null
): Promise<ChatNutritionEditResult> {
  const current = await resolveWorkingNutrition(profile, ctx);
  const req = buildNutritionRequest(profile, undefined, { conversation: conversationOf(ctx) });
  const { lang, region } = req.context;
  const result = editAllDayMenus(current, (menu) =>
    swapFoodInPlan(
      menu,
      { from: args.from, to: args.to, slot: resolveMealSlot(menu, args.meal) },
      {
        constraints: req.constraints,
        preferCheap: req.context.style.budget,
        quick: req.context.style.quick,
        allowProcessedIds: req.context.allowedProcessedIds,
        lang,
        region,
      }
    )
  );
  return finishNutritionEdit(result, lang);
}

/** Change one food's portion ("200g", "3 eggs", "double", "half"); totals recalculated. */
export async function changeFoodPortionForChat(
  profile: Profile,
  args: { food: string; amount: string; meal?: string | null },
  ctx?: CoachChatContext | null
): Promise<ChatNutritionEditResult> {
  const current = await resolveWorkingNutrition(profile, ctx);
  const lang: FoodLang = profile.preferred_locale === "al" ? "al" : "en";
  const result = editAllDayMenus(current, (menu) =>
    changePortionInPlan(
      menu,
      { food: args.food, amount: args.amount, slot: resolveMealSlot(menu, args.meal) },
      { lang }
    )
  );
  return finishNutritionEdit(result, lang);
}

export { NutritionEditError };
