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

function normalizePreferenceText(preferences?: string): string {
  return (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Nutrition / meal plans are not workout week templates. */
function looksLikeNutritionPlanOnly(text: string): boolean {
  if (
    !/\b(nutrition|meal|diet|food|macro|kalor|ushqim)\b/i.test(text) &&
    !/\b(plan|program)\s+(nutrition|meal|diet|ushqimi)\b/i.test(text)
  ) {
    return false;
  }
  return !/\b(workout|training|stervit|strength|gym|hypertrophy|hiit|split)\b/i.test(
    text
  );
}

/**
 * One named focus session (Workouts tab) — push/pull/leg/chest day, etc.
 * Does NOT match multi-focus splits like push/pull/legs.
 */
export function looksLikeNamedFocusSession(preferences?: string): boolean {
  const text = normalizePreferenceText(preferences);
  if (!text.trim()) return false;
  if (/\bpush[\s/]+pull[\s/]+legs?\b|\bppl\b/i.test(text)) return false;
  if (countDistinctFocusNames(text) >= 2) return false;

  return /\b(push(\s*(day|workout|session|focus))?|pull(\s*(day|workout|session|focus))?|legs?(\s*(day|workout|session|focus))?|upper(\s*body)?(\s*(day|workout|session|focus))?|lower(\s*body)?(\s*(day|workout|session|focus))?|chest(\s*(day|workout|session|&?\s*tris?))?|back(\s*(day|workout|session|&?\s*bis?))?|arms?(\s*(day|workout|session))?|shoulders?(\s*(day|workout|session))?|full[\s-]?body(\s*(day|workout|session))?|dite\s+(push|pull|kembesh|krahesh|gjoksi|shpine))\b/i.test(
    text
  );
}

/** How many distinct day-focus names appear (push / pull / legs / …). */
function countDistinctFocusNames(text: string): number {
  const patterns = [
    /\bpush\b/i,
    /\bpull\b/i,
    /\blegs?\b/i,
    /\bupper(\s*body)?\b/i,
    /\blower(\s*body)?\b/i,
    /\bchest\b/i,
    /\bback\b/i,
    /\barms?\b/i,
    /\bshoulders?\b/i,
  ];
  let count = 0;
  for (const re of patterns) {
    if (re.test(text)) count += 1;
  }
  return count;
}

/**
 * Clear multi-day WEEK split language (Plans tab).
 * Deliberately excludes bare "program" / "training days" — those alone used to
 * turn a "push day" into a fake 4-day plan via profile day count.
 */
function hasExplicitMultiDaySplit(text: string): boolean {
  return /\b(\d+\s*[\-]?\s*(day|days)\s+(week|split|program|routine|plan)|full\s+week|weekly\s+(plan|program|split|routine|schedule)|week\s+(plan|program|template|schedule|split)|days?\s+per\s+week|\d+\s+training\s+days|ppl\b|push[\s/]+pull[\s/]+legs?|split\s+(week|routine|program)|hypertrophy\s+split|training\s+week|stervitje\s+javor|plan\s+javor)\b/i.test(
    text
  );
}

/**
 * True when the request means a full WEEK schedule under Plans
 * (multiple training days on a calendar), not one library workout.
 * The word "plan" / "workout plan" counts as a week unless it's clearly
 * a single named focus session ("push day") without split language.
 */
export function looksLikeWeekPlanRequest(preferences?: string): boolean {
  const text = normalizePreferenceText(preferences);
  if (!text.trim() || looksLikeNutritionPlanOnly(text)) return false;

  const namedFocus = looksLikeNamedFocusSession(text);
  const multiDay = hasExplicitMultiDaySplit(text);

  // "push day" / "chest workout" wins over weak "plan" wording unless they
  // clearly asked for a multi-day split (PPL, 4-day week, etc.).
  if (namedFocus && !multiDay) return false;
  if (multiDay) return true;

  // Noun "plan"/"program" / "workout plan" / "make me a plan" → full week schedule.
  // Avoid the verb "I plan to…" (no article / create verb before plan).
  return /\b((workout|training|strength|hypertrophy|gym)\s+(plans?|programs?)|(make|build|create|generate|give|design|need|want)\s+(me\s+)?(a\s+|nje\s+)?(new\s+)?(workout\s+|training\s+)?(plans?|programs?)|(a|my|new|full|nje)\s+(workout\s+|training\s+)?(plans?|programs?))\b/i.test(
    text
  );
}

/**
 * True when preferences clearly mean ONE workout session (Workouts tab),
 * not a multi-day week plan (Plans tab). Explicit week/split language wins.
 */
export function looksLikeSingleSessionRequest(preferences?: string): boolean {
  const text = normalizePreferenceText(preferences);
  if (!text.trim()) return false;

  if (looksLikeWeekPlanRequest(text)) return false;

  if (looksLikeNamedFocusSession(text)) return true;

  return /\b(a\s+(workout|session)|one\s+(workout|session)|single\s+(workout|session)|make\s+(me\s+)?(a\s+)?workout|build\s+(me\s+)?(a\s+)?workout|hiit\s+(session|workout)|tabata\s+(session|workout)|nje\s+stervitje)\b/i.test(
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
