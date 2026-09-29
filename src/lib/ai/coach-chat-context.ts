/**
 * Per-request coach chat context: chronological user turns + the plan the
 * client is currently looking at (latest preview in the thread). Pure.
 */

import { DAY_TITLE_PATTERNS, type DayFocusId } from "@/lib/ai/constraint-language";
import type { AiWeeklyFullProgram } from "@/lib/ai/generate-weekly-full-program";
import type {
  AiGeneratedNutritionPlan,
  AiNutritionDayMenu,
  AiGeneratedWorkoutPlan,
  AiWorkoutDay,
  AiWorkoutExercise,
} from "@/lib/ai/plan-builder-types";

export type WorkingWorkout =
  | { type: "strength"; plan: AiGeneratedWorkoutPlan }
  | { type: "weekly_full"; program: AiWeeklyFullProgram };

export type CoachChatContext = {
  /** Chronological user messages, latest LAST (includes the current message). */
  userTurns: string[];
  /** Latest workout preview in the thread (not yet necessarily applied). */
  workingWorkout: WorkingWorkout | null;
  workingNutrition: AiGeneratedNutritionPlan | null;
};

type HistoryMessage = {
  role: string;
  content?: unknown;
  planPreview?: unknown;
};

const MAX_TURNS = 12;
const MAX_TURN_CHARS = 2000;
/** Older previews are likely stale (applied + edited elsewhere) — use the saved plan instead. */
const PREVIEW_LOOKBACK_MESSAGES = 8;

export function stripInstructionSuffix(text: string): string {
  return text.replace(/\n\n\[Instruction:[\s\S]*$/i, "").trim();
}

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizeExercise(raw: unknown): AiWorkoutExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 120);
  if (!name) return null;
  return {
    name,
    sets: Math.min(10, Math.max(1, Math.round(num(r.sets, 3)))),
    reps: str(r.reps, 30) ?? String(num(r.reps, 10)),
    rest_seconds: Math.min(600, Math.max(0, Math.round(num(r.rest_seconds, 60)))),
    notes: str(r.notes, 300) ?? undefined,
  };
}

function sanitizeDay(raw: unknown): AiWorkoutDay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 80);
  if (!title || !Array.isArray(r.exercises)) return null;
  const exercises = r.exercises
    .slice(0, 15)
    .map(sanitizeExercise)
    .filter((e): e is AiWorkoutExercise => e !== null);
  return exercises.length ? { title, exercises } : null;
}

/** Validate an untrusted strength plan echoed back by the client. */
export function sanitizeStrengthPlan(raw: unknown): AiGeneratedWorkoutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "hiit" || !Array.isArray(r.days)) return null;
  const days = r.days
    .slice(0, 7)
    .map(sanitizeDay)
    .filter((d): d is AiWorkoutDay => d !== null);
  if (!days.length) return null;
  return {
    kind: "strength",
    title: str(r.title, 120) ?? "Workout plan",
    description: str(r.description, 500) ?? "",
    days_per_week: days.length,
    days,
    coach_notes: Array.isArray(r.coach_notes)
      ? r.coach_notes.map((n) => str(n, 300)).filter((n): n is string => !!n).slice(0, 6)
      : [],
  };
}

function sanitizeWeekly(raw: unknown): AiWeeklyFullProgram | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.days) || !r.days.length || r.days.length > 7) return null;
  const ok = r.days.every((d) => {
    if (!d || typeof d !== "object") return false;
    const main = (d as Record<string, unknown>).main as Record<string, unknown> | undefined;
    return main && (main.kind === "strength" || main.kind === "hiit");
  });
  return ok ? (raw as AiWeeklyFullProgram) : null;
}

function sanitizeNutrition(raw: unknown): AiGeneratedNutritionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.meals) || !r.meals.length || !r.daily_targets) return null;
  const variants = Array.isArray(r.day_variants)
    ? r.day_variants
        .filter((v): v is AiNutritionDayMenu => {
          const d = v as Record<string, unknown> | null;
          return !!d && typeof d.label === "string" && Array.isArray(d.meals) && d.meals.length > 0;
        })
        .slice(0, 7)
    : [];
  return { ...(raw as AiGeneratedNutritionPlan), day_variants: variants.length ? variants : undefined };
}

export function extractCoachChatContext(
  history: readonly HistoryMessage[],
  latestMessage: string
): CoachChatContext {
  const userTurns = [
    ...history
      .filter((m) => m.role === "user" && typeof m.content === "string")
      .map((m) => stripInstructionSuffix(m.content as string)),
    stripInstructionSuffix(latestMessage),
  ]
    .filter(Boolean)
    .slice(-MAX_TURNS)
    .map((t) => t.slice(0, MAX_TURN_CHARS));

  let workingWorkout: WorkingWorkout | null = null;
  let workingNutrition: AiGeneratedNutritionPlan | null = null;
  const recent = history.slice(-PREVIEW_LOOKBACK_MESSAGES);
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]!;
    if (m.role !== "assistant" || !m.planPreview || typeof m.planPreview !== "object") continue;
    const preview = m.planPreview as Record<string, unknown>;
    if (!workingWorkout && preview.type === "workout") {
      const plan = sanitizeStrengthPlan(preview.plan);
      if (plan) workingWorkout = { type: "strength", plan };
    } else if (!workingWorkout && preview.type === "weekly_full") {
      const program = sanitizeWeekly(preview.program);
      if (program) workingWorkout = { type: "weekly_full", program };
    } else if (!workingNutrition && preview.type === "nutrition") {
      workingNutrition = sanitizeNutrition(preview.plan);
    }
    if (workingWorkout && workingNutrition) break;
  }
  return { userTurns, workingWorkout, workingNutrition };
}

/** Remove day(s) from a weekly program by 1-based number or focus. Returns null when nothing matched. */
export function removeWeeklyProgramDays(
  program: AiWeeklyFullProgram,
  options: { dayNumber?: number | null; focus?: readonly DayFocusId[] | null }
): { program: AiWeeklyFullProgram; removed: string[] } | null {
  let drop: number[] = [];
  if (options.dayNumber != null && Number.isFinite(options.dayNumber)) {
    const idx = Math.round(options.dayNumber) - 1;
    if (idx >= 0 && idx < program.days.length) drop = [idx];
  } else if (options.focus?.length) {
    drop = program.days
      .map((d, i) => (options.focus!.some((f) => DAY_TITLE_PATTERNS[f].test(weeklyDayTitle(d))) ? i : -1))
      .filter((i) => i >= 0);
  }
  if (!drop.length || drop.length >= program.days.length) return null;
  const set = new Set(drop);
  return {
    program: { ...program, days: program.days.filter((_, i) => !set.has(i)) },
    removed: drop.map((i) => weeklyDayTitle(program.days[i]!)),
  };
}

// ─── Weekly program ⇄ strength plan (for surgical edits) ─────────────────

function weeklyDayTitle(day: AiWeeklyFullProgram["days"][number]): string {
  const main = day.main.kind === "strength" ? day.main.workout.title : day.main.plan.title;
  return day.focus?.trim() || main;
}

/** Strength view of a weekly program (HIIT-main days are left out). */
export function weeklyToStrengthPlan(program: AiWeeklyFullProgram): {
  plan: AiGeneratedWorkoutPlan;
  indexMap: number[];
} {
  const indexMap: number[] = [];
  const days: AiWorkoutDay[] = [];
  program.days.forEach((day, i) => {
    if (day.main.kind !== "strength") return;
    indexMap.push(i);
    days.push({ title: weeklyDayTitle(day), exercises: day.main.workout.exercises.map((e) => ({ ...e })) });
  });
  return {
    plan: {
      kind: "strength",
      title: program.title,
      description: program.description,
      days_per_week: days.length,
      days,
      coach_notes: [...program.coach_notes],
    },
    indexMap,
  };
}

/**
 * Write an edited strength view back into the weekly program. Days are matched
 * by title in order; strength days missing from the edit were removed.
 */
export function applyStrengthPlanToWeekly(
  program: AiWeeklyFullProgram,
  view: { plan: AiGeneratedWorkoutPlan; indexMap: number[] },
  edited: AiGeneratedWorkoutPlan
): AiWeeklyFullProgram {
  const kept = new Map<number, AiWorkoutDay>();
  let cursor = 0;
  for (const day of edited.days) {
    while (cursor < view.plan.days.length && view.plan.days[cursor]!.title !== day.title) cursor += 1;
    if (cursor >= view.plan.days.length) break;
    kept.set(view.indexMap[cursor]!, day);
    cursor += 1;
  }
  const strengthIdx = new Set(view.indexMap);
  const days = program.days.flatMap((day, i) => {
    if (!strengthIdx.has(i)) return [day];
    const next = kept.get(i);
    if (!next || day.main.kind !== "strength") return [];
    return [{ ...day, main: { kind: "strength" as const, workout: { ...day.main.workout, exercises: next.exercises } } }];
  });
  return { ...program, days };
}
