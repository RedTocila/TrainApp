import type { IntakeResponses } from "@/lib/intake-questionnaire";
import {
  EQUIPMENT_OPTIONS,
  TRAINING_EXPERIENCE_OPTIONS,
  TRAINING_DAYS_OPTIONS,
  type IntakeOption,
} from "@/lib/intake-questionnaire";
import { equipmentConstraintFromIntakeAccess } from "@/lib/ai/equipment-taxonomy";

/** Starter programs stay in a practical 3–4 sessions/week band. */
export const STARTER_PROGRAM_WEEKS = 4;
export const STARTER_MIN_DAYS = 3;
export const STARTER_MAX_DAYS = 4;

function optionLabel(options: IntakeOption[], value?: string): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

function optionLabels(options: IntakeOption[], values?: string[]): string[] {
  if (!values?.length) return [];
  return values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);
}

/**
 * Map questionnaire training frequency to starter program days/week (3–4).
 * Light schedules still get a 3-day minimum so the calendar has a real program.
 */
export function daysPerWeekFromIntake(responses: IntakeResponses): number {
  switch (responses.training_days_per_week) {
    case "0_1":
    case "2_3":
      return STARTER_MIN_DAYS;
    case "4_5":
    case "6_plus":
      return STARTER_MAX_DAYS;
    default:
      return STARTER_MIN_DAYS;
  }
}

/** Preferred weekdays (Sun=0 … Sat=6) for N sessions/week. */
export function weekdaysForSessionCount(daysPerWeek: number): number[] {
  const n = Math.min(STARTER_MAX_DAYS, Math.max(STARTER_MIN_DAYS, daysPerWeek));
  if (n >= 4) return [1, 2, 4, 5]; // Mon Tue Thu Fri
  return [1, 3, 5]; // Mon Wed Fri
}

/** Prompt text for equipment — backed by the shared taxonomy allowlist. */
export function equipmentConstraintFromIntake(responses: IntakeResponses): string {
  return equipmentConstraintFromIntakeAccess(responses.equipment_access).promptRule;
}

export function experienceConstraintFromIntake(responses: IntakeResponses): string {
  switch (responses.training_experience) {
    case "beginner":
      return "Beginner: simple compound patterns, clear form cues in notes, moderate volume (mostly 2–3 sets), avoid advanced intensity techniques.";
    case "advanced":
      return "Advanced: structured progressive overload, slightly higher volume and exercise variety, still respect recovery and injuries.";
    case "intermediate":
    default:
      return "Intermediate: balanced volume and progressive overload; keep sessions efficient.";
  }
}

/** Extra prompt preferences string for the onboarding generator. */
export function buildOnboardingProgramPreferences(responses: IntakeResponses): string {
  const days = daysPerWeekFromIntake(responses);
  const experience =
    optionLabel(TRAINING_EXPERIENCE_OPTIONS, responses.training_experience) ??
    "unspecified";
  const daysLabel =
    optionLabel(TRAINING_DAYS_OPTIONS, responses.training_days_per_week) ??
    `${days} days/week`;
  const equipment =
    optionLabels(EQUIPMENT_OPTIONS, responses.equipment_access).join(", ") ||
    "bodyweight / unspecified";

  return [
    `ONBOARDING STARTER PROGRAM (${STARTER_PROGRAM_WEEKS} weeks on calendar).`,
    `Exact training days this week template must include: ${days} (client indicated ${daysLabel}).`,
    `Experience level: ${experience}.`,
    experienceConstraintFromIntake(responses),
    `Equipment: ${equipment}.`,
    equipmentConstraintFromIntake(responses),
    "Build one reusable weekly split that will repeat across the 4-week calendar.",
  ].join("\n");
}
