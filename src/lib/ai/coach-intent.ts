/**
 * Deterministic intent classification for coach chat turns.
 * Distinguishes modify vs generate, remove vs replace, information vs alternatives.
 */

import { normalizeUserText, parseConstraintText, parseDayFocusMentions } from "@/lib/ai/constraint-language";

export type CoachIntentId =
  | "information"
  | "alternatives"
  | "generate_workout"
  | "generate_plan"
  | "remove_day"
  | "remove_exercise"
  | "replace_exercise"
  | "add_exercise"
  | "change_equipment"
  | "change_difficulty"
  | "change_focus"
  | "change_schedule"
  | "modify_workout"
  | "generate_nutrition"
  | "modify_nutrition"
  | "log_activity"
  | "other";

export type CoachIntent = {
  primary: CoachIntentId;
  /** Refers to an existing plan/workout rather than a brand-new one. */
  modifiesExisting: boolean;
  /** User wants something removed WITHOUT a substitute. */
  removeOnly: boolean;
  replacementRequested: boolean;
  isQuestion: boolean;
  nutrition: boolean;
};

const EXERCISE_NOUN_RE =
  /\b(?:squats?|lunges?|deadlifts?|rdls?|press(?:es)?|push[\s-]?ups?|pushups?|pull[\s-]?ups?|pullups?|chin[\s-]?ups?|rows?|curls?|dips?|planks?|crunch(?:es)?|sit[\s-]?ups?|bridges?|thrusts?|burpees?|jumps?|jumping jacks?|climbers?|raises?|fl(?:y|ies|yes)|extensions?|kickbacks?|step[\s-]?ups?|swings?|shrugs?|pulldowns?|exercises?|moves?|movements?|stretch(?:es)?|carries|twists?)\b/;

const GENERATE_VERB_RE =
  /\b(?:make|create|build|generate|design|write|give|get|need|want|plan|program|put together|set up|prepare|suggest|recommend|bere|krijo|jep|me jep)\b/;
const PLAN_NOUN_RE =
  /\b(?:week(?:ly)?|program(?:me)?|plan|split|schedule|routine for the week|\d[\s-]?days?(?: a| per)? week|\d[\s-]?day (?:split|program|plan|routine)|days? (?:a|per) week|java|javor)\b/;
const WORKOUT_NOUN_RE = /\b(?:workout|session|circuit|training|routine|exercises|wod|stervitje|ushtrime)\b/;
const NUTRITION_RE =
  /\b(?:meal|meals|diet|nutrition|food|foods|eat|eating|calorie|calories|kcal|macros?|recipe|breakfast|lunch|dinner|snacks?|grocery|dairy|chicken|fish|vegan|vegetarian|eggs?|rice|oats|oatmeal|yogh?urt|milk|beef|salmon|tuna|tofu|potato(?:es)?|bread|pasta|portions?|servings?|gluten|lactose|ushqim|dieta)\b/;
const POLITE_REQUEST_RE =
  /^(?:can|could|would|will) you\b|^(?:can|could) (?:i|we) (?:swap|switch|replace|change|have|get|use|do)\b|^(?:please|pls)\b/;
const MODIFY_RE =
  /\b(?:make it|make this|make them|change|modify|adjust|update|tweak|edit|swap|switch|replace|remove|delete|take out|drop|add|put|instead|actually|now|my (?:plan|workout|program|routine)|this (?:plan|workout|program|routine|session)|the (?:plan|workout|program|routine|session)|current (?:plan|workout|program))\b/;
const REPLACE_RE =
  /\b(?:replace|swap|substitute|sub(?: out| in)?|switch (?:out|to)|exchange|change (?:it|them|that|this|\w+) (?:to|for|with|into)|instead|in (?:its|their) place|alternative(?:s)? (?:to|for)|something else)\b/;
const REMOVE_RE =
  /\b(?:remove|delete|take out|drop|get rid of|leave out|cut|skip|lose the|no more|hiq|hiqe)\b/;
const QUESTION_START_RE =
  /^(?:what|why|how|is|are|should|can|could|would|does|do|which|when|where|who|explain|tell me)\b/;
const ALTERNATIVES_RE =
  /\b(?:alternatives?|substitutes?|options?|what (?:can|could|should) i do instead|instead of .* what|other exercises? (?:for|like|instead))\b/;

/** Classify a single user message (optionally knowing a plan already exists). */
export function classifyCoachIntent(
  message: string,
  context?: { hasExistingPlan?: boolean }
): CoachIntent {
  const t = normalizeUserText(message);
  const parsed = parseConstraintText(t);
  const hasPlan = context?.hasExistingPlan ?? false;
  const isQuestion = /\?\s*$/.test(t) || QUESTION_START_RE.test(t);
  const nutrition = NUTRITION_RE.test(t) && !/\bworkout|exercise|training\b/.test(t.replace(/\bpre[\s-]?workout|post[\s-]?workout\b/g, ""));
  const generateVerb = GENERATE_VERB_RE.test(t);
  const modifyCue = MODIFY_RE.test(t);
  const replacementRequested = REPLACE_RE.test(t);
  const removeCue = REMOVE_RE.test(t);

  const dayRemoval = parsed.negated.some(
    (n) => n.kind !== "reduce" && parseDayFocusMentions(n.target).length > 0
  ) || /\b(?:remove|delete|drop|take out|get rid of|skip|cut)\s+(?:the\s+)?(?:day\s*\d|\w+day\b(?:'s)? (?:session|workout)?|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))/.test(t);
  const exerciseMentioned = EXERCISE_NOUN_RE.test(t);

  const base = {
    isQuestion,
    nutrition,
    replacementRequested,
  };

  if (/\b(?:i (?:did|just did|completed|finished)|log (?:my|a|this)|track (?:my|this))\b/.test(t)) {
    return { primary: "log_activity", modifiesExisting: false, removeOnly: false, ...base };
  }

  if (nutrition) {
    const modify = hasPlan && (modifyCue || removeCue) && !/\b(?:new|another|fresh)\b/.test(t);
    const politeRequest = POLITE_REQUEST_RE.test(t) && (modifyCue || replacementRequested || removeCue);
    const asksToBuild = GENERATE_VERB_RE.test(t.replace(/\b(?:my|the|this|your|current|meal|diet|nutrition) plan\b/g, " "));
    const nutritionQuestion = isQuestion || /^why\b/.test(t);
    if (nutritionQuestion && !asksToBuild && !politeRequest) {
      return { primary: "information", modifiesExisting: false, removeOnly: false, ...base };
    }
    return {
      primary: modify ? "modify_nutrition" : "generate_nutrition",
      modifiesExisting: modify,
      removeOnly: removeCue && !replacementRequested,
      ...base,
    };
  }

  // "What are alternatives to squats?" → list options, do NOT change the plan.
  if (ALTERNATIVES_RE.test(t) && isQuestion && !/\b(?:replace|swap) (?:it|them|that)\b/.test(t)) {
    return { primary: "alternatives", modifiesExisting: false, removeOnly: false, ...base };
  }

  if (dayRemoval && !generateVerb) {
    return {
      primary: "remove_day",
      modifiesExisting: true,
      removeOnly: !replacementRequested,
      ...base,
    };
  }

  if (exerciseMentioned && replacementRequested && !/\b(?:new|another|fresh) (?:plan|workout|program)\b/.test(t)) {
    return { primary: "replace_exercise", modifiesExisting: true, removeOnly: false, ...base };
  }

  if (exerciseMentioned && removeCue && !replacementRequested && (!generateVerb || /^(?:remove|delete|take out|drop|get rid of)\b/.test(t))) {
    return { primary: "remove_exercise", modifiesExisting: true, removeOnly: true, ...base };
  }

  if (isQuestion && !generateVerb && !modifyCue) {
    return { primary: "information", modifiesExisting: false, removeOnly: false, ...base };
  }

  if (/\b(?:add|include|put in|throw in)\b/.test(t) && exerciseMentioned && hasPlan && !/\b(?:new|another|fresh)\b/.test(t) && !PLAN_NOUN_RE.test(t)) {
    return { primary: "add_exercise", modifiesExisting: true, removeOnly: false, ...base };
  }

  const existingRef = hasPlan && modifyCue && !/\b(?:new|another|fresh|different)\b/.test(t);
  if (existingRef) {
    if (/\b(?:harder|easier|more (?:challenging|difficult|intense)|less (?:intense|difficult)|too (?:hard|easy)|intensity|beginner friendly)\b/.test(t)) {
      return { primary: "change_difficulty", modifiesExisting: true, removeOnly: false, ...base };
    }
    if (/\b(?:dumbbells?|bands?|kettlebells?|barbell|equipment|body ?weight|bodyweight|machines?|gym|home|nothing)\b/.test(t)) {
      return { primary: "change_equipment", modifiesExisting: true, removeOnly: false, ...base };
    }
    if (/\b(?:days?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|schedule|times a week)\b/.test(t)) {
      return { primary: "change_schedule", modifiesExisting: true, removeOnly: false, ...base };
    }
    if (/\b(?:more|less|focus|emphasis|prioriti[sz]e|without|no)\b/.test(t)) {
      return { primary: "change_focus", modifiesExisting: true, removeOnly: false, ...base };
    }
    return { primary: "modify_workout", modifiesExisting: true, removeOnly: false, ...base };
  }

  if (PLAN_NOUN_RE.test(t) && (generateVerb || WORKOUT_NOUN_RE.test(t))) {
    return { primary: "generate_plan", modifiesExisting: false, removeOnly: false, ...base };
  }
  if (generateVerb && (WORKOUT_NOUN_RE.test(t) || exerciseMentioned) || /\bworkout\b/.test(t)) {
    return { primary: "generate_workout", modifiesExisting: false, removeOnly: false, ...base };
  }
  if (isQuestion) {
    return { primary: "information", modifiesExisting: false, removeOnly: false, ...base };
  }
  return { primary: "other", modifiesExisting: false, removeOnly: false, ...base };
}

export function isPlanMutatingIntent(intent: CoachIntentId): boolean {
  return (
    intent === "remove_day" ||
    intent === "remove_exercise" ||
    intent === "replace_exercise" ||
    intent === "add_exercise" ||
    intent === "change_equipment" ||
    intent === "change_difficulty" ||
    intent === "change_focus" ||
    intent === "change_schedule" ||
    intent === "modify_workout" ||
    intent === "generate_workout" ||
    intent === "generate_plan"
  );
}

export { EXERCISE_NOUN_RE };
