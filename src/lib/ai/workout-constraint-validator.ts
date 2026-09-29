/**
 * Deterministic post-generation validation of workouts against the user's
 * explicit constraints (never trusts the LLM). Produces hard violations
 * (must be fixed / regenerated) and soft ones (quality warnings), plus a
 * final guard that strips anything still violating a hard rule.
 */

import { describeMuscleGroups, DAY_TITLE_PATTERNS } from "@/lib/ai/constraint-language";
import { exerciseRejection } from "@/lib/ai/exercise-knowledge";
import { getExerciseProfile } from "@/lib/ai/exercise-profile";
import { isUnrestricted } from "@/lib/ai/equipment-taxonomy";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
} from "@/lib/ai/plan-builder-types";
import { estimateHiitSessionMinutes, estimateStrengthSessionMinutes, DURATION_TOLERANCE_MINUTES } from "@/lib/ai/workout-duration-enforce";
import {
  exerciseFilterFromRequirements,
  type WorkoutRequirements,
} from "@/lib/ai/workout-requirements";
import { findCatalogExercise } from "@/lib/exercise-catalog";

export type ViolationCode =
  | "equipment"
  | "excluded_family"
  | "excluded_name"
  | "avoided_muscle"
  | "injury"
  | "difficulty"
  | "impact"
  | "unknown_exercise"
  | "missing_required"
  | "exercise_count"
  | "duration"
  | "excluded_day_focus"
  | "day_count"
  | "focus_bias"
  | "duplicate";

export type ConstraintViolation = {
  severity: "hard" | "soft";
  code: ViolationCode;
  message: string;
  exercise?: string;
  day?: string;
};

export type ValidationReport = {
  ok: boolean;
  hard: ConstraintViolation[];
  soft: ConstraintViolation[];
};

export type SessionContext = "main" | "warmup" | "stretch";

function report(violations: ConstraintViolation[]): ValidationReport {
  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");
  return { ok: hard.length === 0, hard, soft };
}

function requiredNames(req: WorkoutRequirements): Set<string> {
  return new Set(
    req.requiredExercises.map((r) => r.catalogName?.toLowerCase()).filter(Boolean) as string[]
  );
}

/** Validate one list of exercise names (a session / HIIT config). */
export function validateExerciseNames(
  names: string[],
  req: WorkoutRequirements,
  options?: { context?: SessionContext; dayTitle?: string; checkFocus?: boolean; checkCount?: boolean }
): ConstraintViolation[] {
  const context = options?.context ?? "main";
  const day = options?.dayTitle;
  const filter = exerciseFilterFromRequirements(req, { forMobility: context !== "main" });
  const required = requiredNames(req);
  const out: ConstraintViolation[] = [];
  const seen = new Set<string>();
  let focusHits = 0;
  let known = 0;

  for (const name of names) {
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      out.push({ severity: "soft", code: "duplicate", message: `${name} appears twice`, exercise: name, day });
    }
    seen.add(lower);
    const ex = findCatalogExercise(name);
    if (!ex) {
      if (!isUnrestricted(req.equipment)) {
        out.push({
          severity: "hard",
          code: "unknown_exercise",
          message: `${name} is not in the exercise library, so its equipment can't be verified`,
          exercise: name,
          day,
        });
      }
      continue;
    }
    known += 1;
    const rejection = exerciseRejection(ex, filter);
    const exempt =
      required.has(lower) && (rejection?.code === "difficulty" || rejection?.code === "avoided_muscle");
    if (rejection && !exempt) {
      out.push({
        severity: "hard",
        code: rejection.code,
        message: `${ex.name}: ${rejection.detail}`,
        exercise: ex.name,
        day,
      });
    }
    if (req.focusGroups.length > 0) {
      const p = getExerciseProfile(ex);
      if (p.primaryGroups.some((g) => req.focusGroups.includes(g))) focusHits += 1;
    }
  }

  if (context === "main" && options?.checkFocus && req.focusGroups.length > 0 && known >= 3) {
    const ratio = focusHits / known;
    if (ratio < 0.5) {
      out.push({
        severity: "soft",
        code: "focus_bias",
        message: `Only ${focusHits}/${known} exercises target ${describeMuscleGroups(req.focusGroups)}`,
        day,
      });
    }
  }

  if (context === "main" && options?.checkCount !== false && req.exerciseCount != null && names.length !== req.exerciseCount) {
    out.push({
      severity: names.length > req.exerciseCount ? "hard" : "soft",
      code: "exercise_count",
      message: `${names.length} exercises instead of ${req.exerciseCount}`,
      day,
    });
  }

  if (context === "main") {
    for (const r of req.requiredExercises) {
      if (!r.catalogName) continue;
      if (!names.some((n) => n.toLowerCase() === r.catalogName!.toLowerCase())) {
        out.push({
          severity: "soft",
          code: "missing_required",
          message: `Required exercise ${r.catalogName} is missing`,
          day,
        });
      }
    }
  }
  return out;
}

/** Day titles that match an excluded day focus ("Leg Day" when legs were removed). */
export function dayMatchesExcludedFocus(title: string, req: WorkoutRequirements): string | null {
  for (const focus of req.excludedDayFocuses) {
    if (DAY_TITLE_PATTERNS[focus]?.test(title)) return focus;
  }
  return null;
}

export function validateWorkoutPlan(
  plan: AiGeneratedWorkoutPlan,
  req: WorkoutRequirements,
  options?: { expectedDays?: number | null }
): ValidationReport {
  const out: ConstraintViolation[] = [];
  const expected = options?.expectedDays ?? req.daysPerWeek;
  if (expected != null && plan.days.length !== expected) {
    out.push({
      severity: "hard",
      code: "day_count",
      message: `${plan.days.length} training days instead of ${expected}`,
    });
  }
  for (const day of plan.days) {
    const excludedFocus = dayMatchesExcludedFocus(day.title, req);
    if (excludedFocus) {
      out.push({
        severity: "hard",
        code: "excluded_day_focus",
        message: `"${day.title}" is a ${excludedFocus.replace(/_/g, " ")} day, which was removed`,
        day: day.title,
      });
    }
    out.push(
      ...validateExerciseNames(
        day.exercises.map((e) => e.name),
        req,
        { dayTitle: day.title, checkFocus: false }
      )
    );
  }
  return report(out);
}

export function validateWorkoutDay(day: AiGeneratedWorkoutDay, req: WorkoutRequirements): ValidationReport {
  const out = validateExerciseNames(
    day.exercises.map((e) => e.name),
    req,
    { dayTitle: day.title, checkFocus: true }
  );
  if (req.durationMinutes != null) {
    const minutes = estimateStrengthSessionMinutes(day.exercises);
    if (minutes > req.durationMinutes + DURATION_TOLERANCE_MINUTES) {
      out.push({
        severity: "hard",
        code: "duration",
        message: `~${minutes} min instead of ~${req.durationMinutes} min`,
        day: day.title,
      });
    }
  }
  return report(out);
}

export function validateHiitPlan(
  plan: AiGeneratedHiitPlan,
  req: WorkoutRequirements,
  context: SessionContext = "main"
): ValidationReport {
  const out = validateExerciseNames(
    plan.config.exercises.map((e) => e.name),
    req,
    { context, dayTitle: plan.title, checkFocus: context === "main" }
  );
  if (context === "main" && req.durationMinutes != null) {
    const minutes = estimateHiitSessionMinutes(plan.config);
    if (minutes > req.durationMinutes + DURATION_TOLERANCE_MINUTES) {
      out.push({
        severity: "hard",
        code: "duration",
        message: `~${minutes} min instead of ~${req.durationMinutes} min`,
        day: plan.title,
      });
    }
  }
  return report(out);
}

/** Final guard: drop any exercise that still breaks a hard per-exercise rule. */
export function stripHardViolations<T extends { name: string }>(
  list: T[],
  req: WorkoutRequirements,
  context: SessionContext = "main"
): { value: T[]; removed: string[] } {
  const filter = exerciseFilterFromRequirements(req, { forMobility: context !== "main" });
  const required = requiredNames(req);
  const removed: string[] = [];
  const value = list.filter((item) => {
    const ex = findCatalogExercise(item.name);
    if (!ex) {
      if (isUnrestricted(req.equipment)) return true;
      removed.push(item.name);
      return false;
    }
    const rejection = exerciseRejection(ex, filter);
    if (!rejection) return true;
    if (required.has(item.name.toLowerCase()) && (rejection.code === "difficulty" || rejection.code === "avoided_muscle")) {
      return true;
    }
    removed.push(item.name);
    return false;
  });
  return { value, removed };
}

/** Feedback appended to a regeneration prompt. */
export function formatViolationsForPrompt(r: ValidationReport): string {
  const lines = [...r.hard, ...r.soft.filter((v) => v.code === "focus_bias")].slice(0, 12).map(
    (v) => `- ${v.severity === "hard" ? "HARD" : "soft"} ${v.code}: ${v.message}${v.day ? ` (in "${v.day}")` : ""}`
  );
  if (lines.length === 0) return "";
  return `YOUR PREVIOUS ATTEMPT BROKE THESE CONSTRAINTS — fix every one (pick different library exercises; do not repeat them):\n${lines.join("\n")}`;
}

// ─── Generate → enforce → validate → (regenerate once) pipeline ─────────────

export type ValidatedGenerationResult<T> = {
  value: T;
  attempts: number;
  report: ValidationReport;
  /** Repairs applied by deterministic enforcement on the returned attempt. */
  repairCount: number;
};

/**
 * Runs `generate` (LLM), deterministic `enforce`, and `validate`.
 * Regenerates ONCE with feedback when the raw output broke hard rules badly
 * (hard violations remain after enforcement, or more than half the items
 * needed repair). Always returns the best enforced attempt.
 */
export async function generateWithValidation<Raw, T>(opts: {
  generate: (feedback: string | null) => Promise<Raw>;
  enforce: (raw: Raw) => { value: T; repairCount: number; itemCount: number };
  validate: (value: T) => ValidationReport;
  /** Validate raw output (before enforcement) to decide on regeneration. */
  validateRaw?: (raw: Raw) => ValidationReport;
  maxAttempts?: number;
}): Promise<ValidatedGenerationResult<T>> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
  let feedback: string | null = null;
  let best: ValidatedGenerationResult<T> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await opts.generate(feedback);
    const rawReport = opts.validateRaw?.(raw) ?? null;
    const enforced = opts.enforce(raw);
    const finalReport = opts.validate(enforced.value);
    const current: ValidatedGenerationResult<T> = {
      value: enforced.value,
      attempts: attempt,
      report: finalReport,
      repairCount: enforced.repairCount,
    };
    if (
      !best ||
      finalReport.hard.length < best.report.hard.length ||
      (finalReport.hard.length === best.report.hard.length && enforced.repairCount < best.repairCount)
    ) {
      best = current;
    }

    const heavyRepair = enforced.itemCount > 0 && enforced.repairCount / enforced.itemCount > 0.5;
    const needsRetry = !finalReport.ok || heavyRepair;
    if (!needsRetry || attempt === maxAttempts) break;
    feedback = formatViolationsForPrompt(rawReport && !rawReport.ok ? rawReport : finalReport);
    if (!feedback) break;
  }
  return best!;
}
