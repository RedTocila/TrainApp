import type { WorkoutPlanKind } from "@/lib/hiit";
import { isExtraWorkoutKind } from "@/lib/hiit";

/**
 * Prefer an explicit kind from the UI/tool.
 * Otherwise map what the user wrote → strength (sets/reps) or hiit (intervals).
 * Default strength.
 *
 * Sets/reps (strength): hypertrophy, powerlifting, calisthenics, functional,
 * kettlebell, bodybuilding, classic strength — anything logged as sets × reps.
 * Intervals (hiit): HIIT, Tabata, timed circuits, EMOM/AMRAP/for-time, metcons.
 */
export function inferAiWorkoutKind(
  preferences?: string,
  explicit?: WorkoutPlanKind | null
): WorkoutPlanKind {
  if (
    explicit === "hiit" ||
    explicit === "strength" ||
    explicit === "warmup" ||
    explicit === "stretch"
  ) {
    return explicit;
  }
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return "strength";

  if (
    /\b(warm[\s-]?up|warmup|nxehje|ngrohje)\b/i.test(text) &&
    !/\b(stretch|stretching|mobility|flexibility|shtrirje)\b/i.test(text) &&
    !/\b(workout|stervitje|training|main|full)\b/i.test(text)
  ) {
    return "warmup";
  }
  if (
    /\b(stretch|stretching|mobility|flexibility|cool[\s-]?down|shtrirje|mobilitet|yoga|pilates)\b/i.test(
      text
    ) &&
    !/\b(workout|stervitje|training|main|full|upper|lower|push|pull|strength|hypertrophy|hiit)\b/i.test(
      text
    )
  ) {
    return "stretch";
  }

  const wantsHiit = mentionsIntervalFormat(text);
  if (!wantsHiit) return "strength";

  // Explicit sets/reps style wins over a vague "circuit" unless they also said HIIT/Tabata.
  if (mentionsSetsFormat(text) && !/\b(hiit|tabata|emom|amrap)\b/i.test(text)) {
    return "strength";
  }

  return "hiit";
}

/** Main session only — warm-up / stretch keywords do not override the main workout type. */
export function inferAiMainWorkoutKind(
  preferences?: string
): "strength" | "hiit" {
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return "strength";

  const wantsHiit = mentionsIntervalFormat(text);
  if (!wantsHiit) return "strength";

  if (mentionsSetsFormat(text) && !/\b(hiit|tabata|emom|amrap)\b/i.test(text)) {
    return "strength";
  }
  return "hiit";
}

/**
 * True when preferences clearly mean ONE workout session (Workouts tab),
 * not a multi-day week plan (Plans tab). Explicit week/program language wins.
 */
export function looksLikeSingleSessionRequest(preferences?: string): boolean {
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return false;

  const wantsWeek =
    /\b(\d+\s*[\-]?\s*(day|days)\s+(week|split|program|routine)|full\s+week|weekly\s+(plan|program|split)|week\s+plan|training\s+days|days?\s+per\s+week|ppl\b|push[\s/]+pull[\s/]+legs|program|split\s+(week|routine)|stervitje\s+javor|plan\s+javor)\b/i.test(
      text
    );
  if (wantsWeek) return false;

  return /\b(push\s*day|pull\s*day|leg\s*day|legs?\s*day|upper(\s*body)?(\s*day)?|lower(\s*body)?(\s*day)?|chest\s*day|back\s*day|arm\s*day|shoulder\s*day|a\s+(workout|session)|one\s+(workout|session)|single\s+(workout|session)|hiit\s+(session|workout)|tabata\s+(session|workout)|dite\s+push|dite\s+pull|dite\s+kembesh)\b/i.test(
    text
  );
}

/** Interval-timer formats → workout_kind "hiit". */
function mentionsIntervalFormat(text: string): boolean {
  return (
    /\b(hiit|high[\s-]?intensity(\s+interval)?(\s+training)?|tabata|interval\s*training|timed\s*intervals?|circuit\s*(timer|training|workout)?|intervale|intervalesh|kohemates|me\s+kohe|intensitet\s+i\s+larte|emom|amrap|for[\s-]?time|metcon|crossfit|wod)\b/i.test(
      text
    ) || /\b(stervitje|workout|session|plan)\s+hiit\b/i.test(text)
  );
}

/** Classic sets × reps styles → workout_kind "strength". */
function mentionsSetsFormat(text: string): boolean {
  return /\b(traditional|strength\s*training|hypertrophy|bodybuilding|powerlifting|powerlift|calisthenics|calisthenic|functional\s*training|kettlebell|sets?\s*(and|&|\/|x|×)\s*reps?|fitness(\s+workout)?|normal\s+workout|tradicional|hipertrofi|bodybuild|powerlift|kalistenik[ae]?|funksional|seri\s*(dhe|&|\/)\s*perseritje|sete\s*(dhe|&|\/)\s*reps?)\b/i.test(
    text
  );
}

export { isExtraWorkoutKind };
