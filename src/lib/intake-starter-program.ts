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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Catalog names with GIFs, rotated across the preview week. */
const GYM_EXAMPLE_EXERCISES = [
  ["barbell bench press", "dumbbell incline bench press", "barbell seated overhead press", "cable pushdown"],
  ["pull-up", "barbell bent over row", "cable pulldown", "barbell curl"],
  ["barbell full squat", "barbell romanian deadlift", "walking lunge", "barbell glute bridge"],
  ["dumbbell bench press", "barbell bent over row", "barbell seated overhead press", "cable pulldown"],
] as const;

const HOME_EXAMPLE_EXERCISES = [
  ["dumbbell bench press", "push-up", "dumbbell lunge", "glute bridge march"],
  ["dumbbell bent over row", "dumbbell romanian deadlift", "walking lunge", "crunch floor"],
  ["dumbbell lunge", "dumbbell romanian deadlift", "jump squat", "glute bridge march"],
  ["dumbbell bench press", "dumbbell bent over row", "push-up", "bench dip on floor"],
] as const;

const BODYWEIGHT_EXAMPLE_EXERCISES = [
  ["push-up", "jump squat", "walking lunge", "glute bridge march"],
  ["bench dip on floor", "mountain climber", "glute bridge march", "crunch floor"],
  ["walking lunge", "jump squat", "glute bridge march", "burpee"],
  ["push-up", "bench dip on floor", "mountain climber", "crunch floor"],
] as const;

export type StarterProgramPreview = {
  daysPerWeek: number;
  weeks: number;
  sessions: number;
  weekdays: number[];
  weekdayLabels: string[];
  /** Example catalog exercises (with GIFs) for each weekday, same order as weekdays. */
  exampleExercises: string[][];
  experience: string;
  equipment: string;
};

function exampleExerciseSets(responses: IntakeResponses): readonly (readonly string[])[] {
  const access = responses.equipment_access ?? [];
  if (access.includes("full_gym")) return GYM_EXAMPLE_EXERCISES;
  if (access.includes("home_dumbbells")) return HOME_EXAMPLE_EXERCISES;
  return BODYWEIGHT_EXAMPLE_EXERCISES;
}

/** What the questionnaire completion screen shows before the calendar is filled. */
export function starterProgramPreview(responses: IntakeResponses): StarterProgramPreview {
  const daysPerWeek = daysPerWeekFromIntake(responses);
  const weekdays = weekdaysForSessionCount(daysPerWeek);
  const examples = exampleExerciseSets(responses);
  const experience =
    optionLabel(TRAINING_EXPERIENCE_OPTIONS, responses.training_experience) ??
    "Matched to your level";
  const equipment =
    optionLabels(EQUIPMENT_OPTIONS, responses.equipment_access).join(", ") ||
    "Bodyweight";

  return {
    daysPerWeek,
    weeks: STARTER_PROGRAM_WEEKS,
    sessions: daysPerWeek * STARTER_PROGRAM_WEEKS * 3,
    weekdays,
    weekdayLabels: weekdays.map((day) => WEEKDAY_SHORT[day] ?? "Mon"),
    exampleExercises: weekdays.map((_, index) => [...examples[index % examples.length]]),
    experience,
    equipment,
  };
}

/** Prompt text for equipment — backed by the shared taxonomy allowlist. */
export function equipmentConstraintFromIntake(responses: IntakeResponses): string {
  return equipmentConstraintFromIntakeAccess(responses.equipment_access).promptRule;
}

export function experienceConstraintFromIntake(responses: IntakeResponses): string {
  switch (responses.training_experience) {
    case "beginner":
      return "Beginner: simple patterns and clear form cues in notes. Still a full session — one primary compound, secondary lifts, and accessories, about three sets each. No advanced intensity techniques.";
    case "advanced":
      return "Advanced: full session with four to five sets on the primary lifts, more exercise variety, progressive overload, and respect for recovery and injuries.";
    case "intermediate":
    default:
      return "Intermediate: full session with three to four sets on compounds, accessories after the main lifts, and progressive overload.";
  }
}

/** True when the client asked for intervals and did not also ask for strength work. */
export function wantsIntervalMainFromIntake(responses: IntakeResponses): boolean {
  const styles = (responses.workout_styles ?? []).map((style) => style.toLowerCase());
  if (styles.length === 0) return false;
  const interval = styles.some((style) =>
    /hiit|tabata|interval|circuit|emom|amrap/.test(style)
  );
  const strength = styles.some((style) =>
    /strength|hypertrophy|weight|power|bodybuild|muscle|resistance/.test(style)
  );
  return interval && !strength;
}

/** Minute target for the main block. Small session requests stay high enough that a full workout is not stripped down. */
export function onboardingMainMinutes(responses: IntakeResponses): number {
  const raw = responses.workout_duration ?? "";
  const match = raw.match(/(\d{2,3})/);
  const parsed = match ? parseInt(match[1]!, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 40 && parsed <= 90) return parsed;
  return 65;
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

  const intervalMain = wantsIntervalMainFromIntake(responses);
  const format = intervalMain
    ? "Main workout format: HIIT intervals."
    : "Main workout format: traditional sets and reps.";
  const minutes = onboardingMainMinutes(responses);
  const location = responses.training_location?.trim();
  const styles = intervalMain
    ? ""
    : (responses.workout_styles ?? [])
        .filter((style) => !/hiit|tabata|interval|circuit|emom|amrap/i.test(style))
        .join(", ");

  return [
    `ONBOARDING PROGRAM (${STARTER_PROGRAM_WEEKS} weeks on the calendar).`,
    `Exact training days this weekly template must include: ${days} (client indicated ${daysLabel}).`,
    `Experience level: ${experience}.`,
    experienceConstraintFromIntake(responses),
    `Equipment: ${equipment}.`,
    equipmentConstraintFromIntake(responses),
    format,
    location ? `Training location: ${location.replaceAll("_", " ")}.` : "",
    styles ? `Preferred styles: ${styles.replaceAll("_", " ")}.` : "",
    `Size the main block for about ${minutes} minutes.`,
    "Every training day needs three parts: a warm-up, a complete main workout, and stretching matched to that day's muscles.",
    "The main block must include a primary lift, secondary lifts, and accessories. A three-move sample is not a workout.",
    "Use the whole questionnaire: goal, timeline, injuries, sleep, stress, job, and current activities must change exercise choice and volume.",
    "If sleep is short or stress is high, stay at the lower end of the set range and skip extra finishers.",
    "One reusable weekly split, repeated across the 4-week calendar.",
  ]
    .filter(Boolean)
    .join("\n");
}
