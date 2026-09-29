/**
 * Surgical workout edits — mutate the current plan without full regeneration.
 * Used for remove / add / replace / make harder|easier.
 */

import {
  resolveEquipmentConstraint,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import {
  buildWorkoutCandidatePool,
  pickReplacementFromPool,
} from "@/lib/ai/workout-candidate-pool";
import {
  exerciseMatchesAnyFamily,
  resolveExerciseRef,
  type ExerciseFamilyId,
} from "@/lib/ai/exercise-semantic-match";
import {
  exerciseFilterFromRequirements,
  resolveWorkoutRequirements,
  type WorkoutRequirements,
} from "@/lib/ai/workout-requirements";
import { exerciseRejection, pickAlternative } from "@/lib/ai/exercise-knowledge";
import { getExerciseProfile, type MuscleGroupId } from "@/lib/ai/exercise-profile";
import {
  DAY_FOCUS_MUSCLES,
  DAY_TITLE_PATTERNS,
  type DayFocusId,
} from "@/lib/ai/constraint-language";
import type {
  AiGeneratedWorkoutPlan,
  AiWorkoutExercise,
  AiWorkoutDay,
} from "@/lib/ai/plan-builder-types";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
} from "@/lib/exercise-catalog";
import type { Profile } from "@/lib/types";

export type SurgicalEditErrorCode =
  | "no_plan"
  | "day_not_found"
  | "exercise_not_found"
  | "empty_day"
  | "cannot_resolve"
  | "duplicate";

export class SurgicalEditError extends Error {
  readonly code: SurgicalEditErrorCode;

  constructor(code: SurgicalEditErrorCode, message: string) {
    super(message);
    this.name = "SurgicalEditError";
    this.code = code;
  }
}

export type SurgicalChange = {
  dayIndex: number; // 0-based
  dayTitle: string;
  action: "remove" | "add" | "replace" | "adjust_difficulty" | "remove_day" | "adapt";
  detail: string;
};

export type SurgicalEditResult = {
  plan: AiGeneratedWorkoutPlan;
  changes: SurgicalChange[];
  summary: string;
};

function clonePlan(plan: AiGeneratedWorkoutPlan): AiGeneratedWorkoutPlan {
  return {
    ...plan,
    kind: "strength",
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({ ...ex })),
    })),
    coach_notes: [...(plan.coach_notes ?? [])],
  };
}

/** Convert 1-based user day number → 0-based index. null = first day / only day. */
export function resolveDayIndex(
  plan: AiGeneratedWorkoutPlan,
  dayNumber?: number | null
): number {
  if (plan.days.length === 0) {
    throw new SurgicalEditError("no_plan", "The workout plan has no days.");
  }
  if (dayNumber == null || !Number.isFinite(dayNumber)) {
    return 0;
  }
  const idx = Math.round(dayNumber) - 1;
  if (idx < 0 || idx >= plan.days.length) {
    throw new SurgicalEditError(
      "day_not_found",
      `Day ${dayNumber} doesn't exist. This plan has ${plan.days.length} day(s): ${plan.days
        .map((d, i) => `${i + 1}. ${d.title}`)
        .join("; ")}.`
    );
  }
  return idx;
}

/**
 * Resolve exercise within a day.
 * Prefer 1-based exercise_number; else match by name (fuzzy / family).
 */
export function resolveExerciseIndex(
  day: AiWorkoutDay,
  options: { exerciseNumber?: number | null; exerciseName?: string | null }
): number {
  const { exerciseNumber, exerciseName } = options;
  if (
    exerciseNumber != null &&
    Number.isFinite(exerciseNumber) &&
    Math.round(exerciseNumber) >= 1
  ) {
    const idx = Math.round(exerciseNumber) - 1;
    if (idx < 0 || idx >= day.exercises.length) {
      throw new SurgicalEditError(
        "exercise_not_found",
        `Exercise #${exerciseNumber} doesn't exist on "${day.title}". It has ${day.exercises.length} exercise(s): ${day.exercises
          .map((e, i) => `${i + 1}. ${e.name}`)
          .join("; ")}.`
      );
    }
    return idx;
  }

  const query = exerciseName?.trim();
  if (!query) {
    throw new SurgicalEditError(
      "exercise_not_found",
      `Specify exercise_number (1-based) or exercise_name. Exercises on "${day.title}": ${day.exercises
        .map((e, i) => `${i + 1}. ${e.name}`)
        .join("; ")}.`
    );
  }

  const lower = query.toLowerCase();
  const exact = day.exercises.findIndex(
    (e) => e.name.toLowerCase() === lower
  );
  if (exact >= 0) return exact;

  const partial = day.exercises.findIndex((e) =>
    e.name.toLowerCase().includes(lower)
  );
  if (partial >= 0) return partial;

  // Alias / canonicalize then compare
  const canon = canonicalizeAiExerciseName(query).toLowerCase();
  const byCanon = day.exercises.findIndex(
    (e) => e.name.toLowerCase() === canon || e.name.toLowerCase().includes(canon)
  );
  if (byCanon >= 0) return byCanon;

  throw new SurgicalEditError(
    "exercise_not_found",
    `Couldn't find "${query}" on "${day.title}". Exercises: ${day.exercises
      .map((e, i) => `${i + 1}. ${e.name}`)
      .join("; ")}.`
  );
}

function defaultExercise(
  name: string,
  template?: AiWorkoutExercise | null
): AiWorkoutExercise {
  return {
    name,
    sets: template?.sets ?? 3,
    reps: template?.reps ?? "8-10",
    rest_seconds: template?.rest_seconds ?? 75,
    notes: undefined,
  };
}

function usedNamesOnDay(day: AiWorkoutDay): Set<string> {
  return new Set(day.exercises.map((e) => e.name.toLowerCase()));
}

function equipmentForProfile(
  profile: Profile,
  hint?: string | null,
  conversation?: readonly string[]
): EquipmentConstraint {
  if (conversation?.length) {
    return resolveWorkoutRequirements(profile, hint, { conversation, hasExistingPlan: true }).equipment;
  }
  return resolveEquipmentConstraint(profile, hint);
}

/** Throw when an explicitly named move breaks a hard constraint (muscle, injury, family…). */
function assertNamedExerciseAllowed(
  catalogName: string,
  profile: Profile,
  hint: string | null | undefined,
  conversation: readonly string[] | undefined
): void {
  if (!conversation?.length && !hint?.trim()) return;
  const cat = findCatalogExercise(catalogName);
  if (!cat) return;
  const req = resolveWorkoutRequirements(profile, hint, { conversation, hasExistingPlan: true });
  if (req.requiredExercises.some((r) => r.catalogName?.toLowerCase() === cat.name.toLowerCase())) return;
  const rejection = exerciseRejection(cat, { ...exerciseFilterFromRequirements(req), maxDifficulty: null });
  if (rejection) {
    throw new SurgicalEditError(
      "cannot_resolve",
      `"${cat.name}" conflicts with the client's constraints (${rejection.detail}). Suggest an allowed alternative or ask them to confirm.`
    );
  }
}

export function removeWorkoutExercise(
  plan: AiGeneratedWorkoutPlan,
  options: {
    dayNumber?: number | null;
    exerciseNumber?: number | null;
    exerciseName?: string | null;
  }
): SurgicalEditResult {
  const next = clonePlan(plan);
  const dayIdx = resolveDayIndex(next, options.dayNumber);
  const day = next.days[dayIdx]!;
  const exIdx = resolveExerciseIndex(day, options);
  const removed = day.exercises[exIdx]!;

  if (day.exercises.length <= 1) {
    throw new SurgicalEditError(
      "empty_day",
      `Can't remove the last exercise on "${day.title}". Add a replacement first, or regenerate the day.`
    );
  }

  day.exercises.splice(exIdx, 1);
  const change: SurgicalChange = {
    dayIndex: dayIdx,
    dayTitle: day.title,
    action: "remove",
    detail: `Removed #${exIdx + 1} ${removed.name}`,
  };
  return {
    plan: next,
    changes: [change],
    summary: `Removed ${removed.name} from ${day.title} (day ${dayIdx + 1}). Remaining: ${day.exercises
      .map((e, i) => `${i + 1}. ${e.name}`)
      .join("; ")}.`,
  };
}

export function addWorkoutExercise(
  plan: AiGeneratedWorkoutPlan,
  profile: Profile,
  options: {
    dayNumber?: number | null;
    exerciseName?: string | null;
    /** Soft muscle hint when name omitted, e.g. "shoulders", "glutes". */
    targetMuscle?: string | null;
    sets?: number | null;
    reps?: string | null;
    restSeconds?: number | null;
    preferencesHint?: string | null;
    conversation?: readonly string[];
  }
): SurgicalEditResult {
  const next = clonePlan(plan);
  const dayIdx = resolveDayIndex(next, options.dayNumber);
  const day = next.days[dayIdx]!;
  const equipment = equipmentForProfile(profile, options.preferencesHint, options.conversation);
  const used = usedNamesOnDay(day);

  let catalogName: string | null = null;

  if (options.exerciseName?.trim()) {
    const ref = resolveExerciseRef(options.exerciseName.trim(), equipment);
    catalogName = ref.catalogName;
    if (!catalogName) {
      throw new SurgicalEditError(
        "cannot_resolve",
        `Couldn't match "${options.exerciseName}" to an allowed library exercise for the current equipment.`
      );
    }
    assertNamedExerciseAllowed(catalogName, profile, options.preferencesHint, options.conversation);
  } else {
    const requirements = resolveWorkoutRequirements(
      profile,
      [
        options.preferencesHint,
        options.targetMuscle
          ? `Focus on ${options.targetMuscle}`
          : day.title,
      ]
        .filter(Boolean)
        .join(". "),
      { conversation: options.conversation, hasExistingPlan: true }
    );
    // Narrow focus if target muscle given
    if (options.targetMuscle?.trim()) {
      const m = options.targetMuscle.toLowerCase();
      if (/glute|booty|butt/.test(m)) requirements.focus = ["glutes"];
      else if (/chest|pec/.test(m)) requirements.focus = ["chest"];
      else if (/back|lat/.test(m)) requirements.focus = ["back"];
      else if (/shoulder|delt/.test(m)) requirements.focus = ["shoulders"];
      else if (/arm|bicep|tricep/.test(m)) requirements.focus = ["arms"];
      else if (/core|ab/.test(m)) requirements.focus = ["core"];
      else if (/leg|quad|ham/.test(m)) requirements.focus = ["legs"];
    }
    requirements.equipment = equipment;
    const pool = buildWorkoutCandidatePool(requirements, { cap: 80 });
    const pick = pickReplacementFromPool(pool, options.targetMuscle ?? day.title, used);
    if (!pick) {
      throw new SurgicalEditError(
        "cannot_resolve",
        "Couldn't find a suitable exercise to add under current equipment constraints."
      );
    }
    catalogName = pick.name;
  }

  if (used.has(catalogName.toLowerCase())) {
    throw new SurgicalEditError(
      "duplicate",
      `"${catalogName}" is already on ${day.title}.`
    );
  }

  const template = day.exercises[day.exercises.length - 1] ?? null;
  const exercise = defaultExercise(catalogName, template);
  if (options.sets != null && Number.isFinite(options.sets)) {
    exercise.sets = Math.min(8, Math.max(1, Math.round(options.sets)));
  }
  if (options.reps?.trim()) exercise.reps = options.reps.trim();
  if (options.restSeconds != null && Number.isFinite(options.restSeconds)) {
    exercise.rest_seconds = Math.min(
      300,
      Math.max(30, Math.round(options.restSeconds))
    );
  }

  day.exercises.push(exercise);
  const change: SurgicalChange = {
    dayIndex: dayIdx,
    dayTitle: day.title,
    action: "add",
    detail: `Added ${exercise.name} (${exercise.sets}×${exercise.reps})`,
  };
  return {
    plan: next,
    changes: [change],
    summary: `Added ${exercise.name} to ${day.title} (day ${dayIdx + 1}) as exercise #${day.exercises.length}.`,
  };
}

export function replaceWorkoutExercise(
  plan: AiGeneratedWorkoutPlan,
  profile: Profile,
  options: {
    dayNumber?: number | null;
    exerciseNumber?: number | null;
    exerciseName?: string | null;
    /** Explicit replacement; if omitted, pick a similar allowed alternative. */
    replacementName?: string | null;
    preferencesHint?: string | null;
    /** Chronological user turns so persisted constraints apply to the pick. */
    conversation?: readonly string[];
  }
): SurgicalEditResult {
  const next = clonePlan(plan);
  const dayIdx = resolveDayIndex(next, options.dayNumber);
  const day = next.days[dayIdx]!;
  const exIdx = resolveExerciseIndex(day, options);
  const original = day.exercises[exIdx]!;
  const equipment = equipmentForProfile(profile, options.preferencesHint, options.conversation);
  const used = usedNamesOnDay(day);
  used.delete(original.name.toLowerCase());

  let replacementName: string | null = null;

  if (options.replacementName?.trim()) {
    const ref = resolveExerciseRef(options.replacementName.trim(), equipment);
    replacementName = ref.catalogName;
    if (!replacementName) {
      throw new SurgicalEditError(
        "cannot_resolve",
        `Couldn't match replacement "${options.replacementName}" to an allowed library exercise.`
      );
    }
    assertNamedExerciseAllowed(replacementName, profile, options.preferencesHint, options.conversation);
  } else {
    const requirements = resolveWorkoutRequirements(
      profile,
      options.preferencesHint ?? "",
      { conversation: options.conversation, hasExistingPlan: true }
    );
    requirements.equipment = equipment;
    // Replacing "squats" means a different movement: skip the same family first.
    const filter = exerciseFilterFromRequirements(requirements);
    const pick =
      pickAlternative(original.name, {
        filter,
        usedNames: used,
        avoidSameFamily: true,
        preferGroups: requirements.focusGroups,
      }) ??
      pickAlternative(original.name, { filter, usedNames: used });
    if (!pick) {
      const pool = buildWorkoutCandidatePool(requirements, { cap: 100 });
      const fallback = pickReplacementFromPool(pool, original.name, used);
      if (!fallback) {
        throw new SurgicalEditError(
          "cannot_resolve",
          `Couldn't find a similar replacement for "${original.name}" under current constraints.`
        );
      }
      replacementName = fallback.name;
    } else {
      replacementName = pick.name;
    }
  }

  if (replacementName.toLowerCase() === original.name.toLowerCase()) {
    throw new SurgicalEditError(
      "duplicate",
      `Replacement is the same exercise (${original.name}). Try a different name or ask for something different.`
    );
  }

  // Preserve programming (sets/reps/rest); only change the movement.
  day.exercises[exIdx] = {
    ...original,
    name: replacementName,
    image_url: undefined,
    video_url: undefined,
  };

  const change: SurgicalChange = {
    dayIndex: dayIdx,
    dayTitle: day.title,
    action: "replace",
    detail: `Replaced #${exIdx + 1} ${original.name} → ${replacementName}`,
  };
  return {
    plan: next,
    changes: [change],
    summary: `On ${day.title} (day ${dayIdx + 1}): replaced #${exIdx + 1} ${original.name} with ${replacementName}. Other exercises unchanged.`,
  };
}

function parseRepMidpoint(reps: string): number {
  const m = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) {
    return Math.round(
      (parseInt(m[1]!, 10) + parseInt(m[2]!, 10)) / 2
    );
  }
  const n = parseInt(reps, 10);
  return Number.isFinite(n) ? n : 10;
}

function formatRepRange(mid: number, spread = 2): string {
  const lo = Math.max(3, mid - spread);
  const hi = Math.min(20, mid + spread);
  return `${lo}-${hi}`;
}

/**
 * Make the whole plan (or one day) harder/easier without changing exercises.
 */
export function adjustWorkoutDifficulty(
  plan: AiGeneratedWorkoutPlan,
  direction: "harder" | "easier",
  options?: { dayNumber?: number | null }
): SurgicalEditResult {
  const next = clonePlan(plan);
  const dayIndexes =
    options?.dayNumber != null
      ? [resolveDayIndex(next, options.dayNumber)]
      : next.days.map((_, i) => i);

  const changes: SurgicalChange[] = [];

  for (const dayIdx of dayIndexes) {
    const day = next.days[dayIdx]!;
    for (const ex of day.exercises) {
      const mid = parseRepMidpoint(ex.reps);
      if (direction === "harder") {
        ex.sets = Math.min(6, ex.sets + 1);
        ex.reps = formatRepRange(Math.max(4, mid - 2));
        ex.rest_seconds = Math.min(180, ex.rest_seconds + 15);
      } else {
        ex.sets = Math.max(2, ex.sets - 1);
        ex.reps = formatRepRange(Math.min(15, mid + 2));
        ex.rest_seconds = Math.max(45, ex.rest_seconds - 15);
      }
    }
    changes.push({
      dayIndex: dayIdx,
      dayTitle: day.title,
      action: "adjust_difficulty",
      detail:
        direction === "harder"
          ? "Increased sets, lowered reps, slightly longer rest"
          : "Decreased sets, raised reps, slightly shorter rest",
    });
  }

  const scope =
    options?.dayNumber != null
      ? `day ${options.dayNumber}`
      : "all days";
  return {
    plan: next,
    changes,
    summary: `Made ${scope} ${direction} while keeping the same exercises (${changes
      .map((c) => c.dayTitle)
      .join(", ")}).`,
  };
}

/** List numbered exercises for a day — useful in tool results / prompts. */
export function formatDayExerciseList(
  plan: AiGeneratedWorkoutPlan,
  dayNumber?: number | null
): string {
  const dayIdx = resolveDayIndex(plan, dayNumber);
  const day = plan.days[dayIdx]!;
  return `${day.title} (day ${dayIdx + 1}):\n${day.exercises
    .map(
      (e, i) =>
        `${i + 1}. ${e.name} — ${e.sets}×${e.reps}, rest ${e.rest_seconds}s`
    )
    .join("\n")}`;
}

export function findCatalogExerciseSafe(name: string) {
  return findCatalogExercise(name);
}

// ─── Day removal / plan-wide removal / constraint adaptation ─────────────

/** Share of a day's exercises whose primary muscles sit inside `groups`. */
function dayMuscleShare(day: AiWorkoutDay, groups: readonly MuscleGroupId[]): number {
  if (!groups.length || !day.exercises.length) return 0;
  const set = new Set(groups);
  let hits = 0;
  let known = 0;
  for (const ex of day.exercises) {
    const cat = findCatalogExercise(ex.name);
    if (!cat) continue;
    known += 1;
    const primary = getExerciseProfile(cat).primaryGroups;
    if (primary.length && primary.every((g) => set.has(g))) hits += 1;
  }
  return known ? hits / known : 0;
}

/** Days matching a focus: title first, then content (≥60% of known exercises). */
export function findDaysByFocus(
  plan: AiGeneratedWorkoutPlan,
  focuses: readonly DayFocusId[]
): number[] {
  const byTitle = plan.days
    .map((d, i) => (focuses.some((f) => DAY_TITLE_PATTERNS[f].test(d.title)) ? i : -1))
    .filter((i) => i >= 0);
  if (byTitle.length) return byTitle;
  return plan.days
    .map((d, i) =>
      focuses.some((f) => dayMuscleShare(d, DAY_FOCUS_MUSCLES[f]) >= 0.6) ? i : -1
    )
    .filter((i) => i >= 0);
}

function withDaysPerWeek(plan: AiGeneratedWorkoutPlan): AiGeneratedWorkoutPlan {
  return { ...plan, days_per_week: plan.days.length };
}

/**
 * Remove whole day(s) — no replacement day is generated.
 * Target by 1-based `dayNumber` or by focus ("legs" → "Leg Day", "Lower Body").
 */
export function removeWorkoutDay(
  plan: AiGeneratedWorkoutPlan,
  options: { dayNumber?: number | null; focus?: readonly DayFocusId[] | null }
): SurgicalEditResult {
  const next = clonePlan(plan);
  let indexes: number[];
  if (options.dayNumber != null && Number.isFinite(options.dayNumber)) {
    indexes = [resolveDayIndex(next, options.dayNumber)];
  } else if (options.focus?.length) {
    indexes = findDaysByFocus(next, options.focus);
    if (!indexes.length) {
      throw new SurgicalEditError(
        "day_not_found",
        `No ${options.focus.join("/")} day found. Days: ${next.days
          .map((d, i) => `${i + 1}. ${d.title}`)
          .join("; ")}.`
      );
    }
  } else {
    throw new SurgicalEditError("day_not_found", "Specify day_number or focus to remove a day.");
  }
  if (indexes.length >= next.days.length) {
    throw new SurgicalEditError(
      "empty_day",
      "That would remove every day in the plan. Tell me what to keep, or ask for a new plan."
    );
  }

  const changes: SurgicalChange[] = indexes.map((i) => ({
    dayIndex: i,
    dayTitle: next.days[i]!.title,
    action: "remove_day",
    detail: `Removed day ${i + 1} (${next.days[i]!.title})`,
  }));
  const drop = new Set(indexes);
  next.days = next.days.filter((_, i) => !drop.has(i));
  const result = withDaysPerWeek(next);
  return {
    plan: result,
    changes,
    summary: `Removed ${changes.map((c) => c.dayTitle).join(" and ")}. No replacement added — the plan now has ${
      result.days.length
    } day(s): ${result.days.map((d, i) => `${i + 1}. ${d.title}`).join("; ")}.`,
  };
}

/**
 * Remove every exercise matching families / names / avoided muscles across the plan.
 * Days that would end up empty are dropped (unless it's the last day).
 */
export function removeExercisesMatching(
  plan: AiGeneratedWorkoutPlan,
  match: {
    families?: readonly ExerciseFamilyId[];
    names?: readonly string[];
    avoidGroups?: readonly MuscleGroupId[];
    dayNumber?: number | null;
  }
): SurgicalEditResult {
  const next = clonePlan(plan);
  const families = [...(match.families ?? [])];
  const names = (match.names ?? []).map((n) => n.toLowerCase().trim()).filter(Boolean);
  const avoid = match.avoidGroups ?? [];
  const onlyDay =
    match.dayNumber != null && Number.isFinite(match.dayNumber)
      ? resolveDayIndex(next, match.dayNumber)
      : null;

  const hits = (name: string): boolean => {
    const lower = name.toLowerCase();
    if (families.length && exerciseMatchesAnyFamily(name, families)) return true;
    if (names.some((n) => lower === n || lower.includes(n))) return true;
    if (avoid.length) {
      const cat = findCatalogExercise(name);
      if (cat && exerciseRejection(cat, { avoidGroups: avoid })?.code === "avoided_muscle") return true;
    }
    return false;
  };

  const changes: SurgicalChange[] = [];
  const emptied: number[] = [];
  next.days.forEach((day, i) => {
    if (onlyDay != null && i !== onlyDay) return;
    const removed = day.exercises.filter((e) => hits(e.name));
    if (!removed.length) return;
    day.exercises = day.exercises.filter((e) => !hits(e.name));
    changes.push({
      dayIndex: i,
      dayTitle: day.title,
      action: "remove",
      detail: `Removed ${removed.map((e) => e.name).join(", ")}`,
    });
    if (!day.exercises.length) emptied.push(i);
  });

  if (!changes.length) {
    throw new SurgicalEditError(
      "exercise_not_found",
      `Nothing in the plan matches that. Current exercises: ${next.days
        .map((d, i) => `Day ${i + 1}: ${d.exercises.map((e) => e.name).join(", ")}`)
        .join(" | ")}.`
    );
  }
  if (emptied.length >= next.days.length) {
    throw new SurgicalEditError(
      "empty_day",
      "Removing those would leave the plan empty. Want replacements instead?"
    );
  }
  const drop = new Set(emptied);
  next.days = next.days.filter((_, i) => !drop.has(i));
  const result = withDaysPerWeek(next);
  const droppedNote = emptied.length
    ? ` ${emptied.length} day(s) became empty and were removed.`
    : "";
  return {
    plan: result,
    changes,
    summary: `${changes.map((c) => `${c.dayTitle}: ${c.detail}`).join("; ")}. No replacements added.${droppedNote}`,
  };
}

/**
 * Bring an existing plan in line with (new) hard constraints while keeping
 * everything that already complies. Violating moves are swapped for the closest
 * allowed alternative (same sets/reps); excluded day types are removed.
 */
export function adaptPlanToConstraints(
  plan: AiGeneratedWorkoutPlan,
  requirements: WorkoutRequirements
): SurgicalEditResult {
  let next = clonePlan(plan);
  const changes: SurgicalChange[] = [];

  if (requirements.excludedDayFocuses.length) {
    const idx = findDaysByFocus(next, requirements.excludedDayFocuses);
    if (idx.length && idx.length < next.days.length) {
      const removed = removeWorkoutDay(next, { focus: requirements.excludedDayFocuses });
      next = removed.plan;
      changes.push(...removed.changes);
    }
  }

  const filter = exerciseFilterFromRequirements(requirements);
  const mobilityFilter = exerciseFilterFromRequirements(requirements, { forMobility: true });
  const required = new Set(
    requirements.requiredExercises
      .map((r) => r.catalogName?.toLowerCase())
      .filter((n): n is string => !!n)
  );

  next.days.forEach((day, dayIdx) => {
    const used = usedNamesOnDay(day);
    const kept: AiWorkoutExercise[] = [];
    const notes: string[] = [];
    for (const ex of day.exercises) {
      const cat = findCatalogExercise(ex.name);
      if (!cat || required.has(cat.name.toLowerCase())) {
        kept.push(ex);
        continue;
      }
      const isMobility = getExerciseProfile(cat).isMobility;
      const rejection = exerciseRejection(cat, isMobility ? mobilityFilter : filter);
      if (!rejection) {
        kept.push(ex);
        continue;
      }
      const avoidFamily =
        rejection.code === "excluded_family" || rejection.code === "excluded_name";
      const alt = pickAlternative(cat.name, {
        filter: isMobility ? mobilityFilter : filter,
        usedNames: used,
        avoidSameFamily: avoidFamily,
        preferGroups: requirements.focusGroups,
      });
      if (alt) {
        used.add(alt.name.toLowerCase());
        kept.push({ ...ex, name: alt.name, image_url: undefined, video_url: undefined });
        notes.push(`${ex.name} → ${alt.name} (${rejection.detail})`);
      } else {
        notes.push(`removed ${ex.name} (${rejection.detail})`);
      }
    }
    if (notes.length) {
      day.exercises = kept;
      changes.push({ dayIndex: dayIdx, dayTitle: day.title, action: "adapt", detail: notes.join("; ") });
    }
  });

  next.days = next.days.filter((d) => d.exercises.length > 0);
  if (!next.days.length) {
    throw new SurgicalEditError(
      "empty_day",
      "Nothing in the current plan fits the new constraints — I'll need to build a new one."
    );
  }
  const result = withDaysPerWeek(next);
  return {
    plan: result,
    changes,
    summary: changes.length
      ? `Adapted the plan: ${changes.map((c) => `${c.dayTitle}: ${c.detail}`).join(" | ")}. Everything else unchanged.`
      : "The current plan already fits those constraints — no changes needed.",
  };
}
