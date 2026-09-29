import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { buildPlanTextLanguageRule } from "@/lib/ai/language-instructions";
import { buildCatalogExerciseNameRule } from "@/lib/ai/catalog-exercise-prompt";
import { withPlanMedicalDisclaimer } from "@/lib/ai/plan-medical-disclaimer";
import { enrichExercisesWithDemoVideos } from "@/lib/ai/exercise-video-search";
import {
  assertNoRequirementConflicts,
  buildRequirementsPromptBlock,
  resolveWorkoutRequirements,
  type WorkoutRequirements,
} from "@/lib/ai/workout-requirements";
import {
  buildWorkoutCandidatePool,
  type WorkoutCandidatePool,
} from "@/lib/ai/workout-candidate-pool";
import {
  enforceRequirementsOnHiitPlan,
  enforceRequirementsOnWorkoutDay,
  enforceRequirementsOnWorkoutPlan,
  summarizeRequirementRepairs,
} from "@/lib/ai/workout-requirements-enforce";
import {
  enforceEquipmentOnHiitPlan,
  enforceEquipmentOnWorkoutDay,
  enforceEquipmentOnWorkoutPlan,
  summarizeEquipmentEnforcement,
} from "@/lib/ai/workout-equipment-enforce";
import {
  enforceCandidatePoolOnHiitPlan,
  enforceCandidatePoolOnWorkoutDay,
  enforceCandidatePoolOnWorkoutPlan,
  summarizeCandidatePoolRepairs,
} from "@/lib/ai/workout-candidate-pool-enforce";
import {
  enforceDurationOnHiitPlan,
  enforceDurationOnWorkoutDay,
  enforceDurationOnWorkoutPlan,
  summarizeDurationRepairs,
  buildDurationPromptHint,
} from "@/lib/ai/workout-duration-enforce";
import {
  loadExerciseVarietyContext,
  buildVarietyPromptHint,
  type VarietyContext,
} from "@/lib/ai/workout-variety";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { normalizeHiitConfig, type HiitConfig, type WorkoutPlanKind } from "@/lib/hiit";
import { inferAiWorkoutKind, inferAiMainWorkoutKind } from "@/lib/ai/infer-workout-kind";
import { trainingGoalRulesForAi } from "@/lib/goal-coaching";
import type { Profile } from "@/lib/types";
import {
  STARTER_PROGRAM_WEEKS,
  buildOnboardingProgramPreferences,
  daysPerWeekFromIntake,
  experienceConstraintFromIntake,
} from "@/lib/intake-starter-program";
import { profileToResponses } from "@/lib/intake-questionnaire";
import {
  dayMatchesExcludedFocus,
  generateWithValidation,
  stripHardViolations,
  validateHiitPlan,
  validateWorkoutDay,
  validateWorkoutPlan,
  type SessionContext,
  type ValidatedGenerationResult,
} from "@/lib/ai/workout-constraint-validator";
import { muscleGroupsFromMentions, parseMuscleMentions } from "@/lib/ai/constraint-language";
import { getExerciseProfile } from "@/lib/ai/exercise-profile";
import { findCatalogExercise } from "@/lib/exercise-catalog";

export { inferAiWorkoutKind } from "@/lib/ai/infer-workout-kind";
export {
  WorkoutRequirementConflictError,
  resolveWorkoutRequirements,
  detectRequirementConflicts,
} from "@/lib/ai/workout-requirements";
export { buildWorkoutCandidatePool } from "@/lib/ai/workout-candidate-pool";

type GenerationContext = {
  requirements: WorkoutRequirements;
  pool: WorkoutCandidatePool;
  variety: VarietyContext;
};

/** Conversation-aware inputs shared by every generator. */
export type CoachGenerationInput = {
  /** Chronological user turns (latest LAST) — explicit constraints persist across turns. */
  conversation?: readonly string[];
  hasExistingPlan?: boolean;
};

type EnforcedResult<T> = { value: T; repairCount: number; itemCount: number };

export type GenerationReport = {
  attempts: number;
  autoFixes: number;
  adjustments: string[];
  remainingWarnings: string[];
};

const generationReports = new WeakMap<object, GenerationReport>();

/** Validation/repair summary for a generated plan object (for tool results). */
export function getGenerationReport(plan: object): GenerationReport | null {
  return generationReports.get(plan) ?? null;
}

function recordReport(plan: object, requirements: WorkoutRequirements, result: ValidatedGenerationResult<unknown>): void {
  generationReports.set(plan, {
    attempts: result.attempts,
    autoFixes: result.repairCount,
    adjustments: requirements.adjustments,
    remainingWarnings: [...result.report.hard, ...result.report.soft].map((v) => v.message).slice(0, 6),
  });
}

function withFeedback(prompt: string, feedback: string | null): string {
  return feedback ? `${prompt}\n\n${feedback}` : prompt;
}

/** Surface automatic adjustments (regressions, safety swaps) in coach notes. */
function withAdjustmentNotes(notes: string[], requirements: WorkoutRequirements): string[] {
  if (requirements.adjustments.length === 0) return notes;
  const fresh = requirements.adjustments.filter((a) => !notes.includes(a));
  return [...fresh, ...notes];
}

/** Rename a day whose title contradicts removed/avoided focus ("Leg Day" after "no legs"). */
function fixConflictingDayTitle(title: string, exerciseNames: string[], requirements: WorkoutRequirements): string {
  const excluded = dayMatchesExcludedFocus(title, requirements);
  const mentioned = muscleGroupsFromMentions(parseMuscleMentions(title));
  const avoid = new Set(requirements.avoidMuscles);
  const avoidConflict = mentioned.length > 0 && mentioned.every((g) => avoid.has(g));
  if (!excluded && !avoidConflict) return title;
  const counts = new Map<string, number>();
  for (const name of exerciseNames) {
    const ex = findCatalogExercise(name);
    if (!ex) continue;
    for (const g of getExerciseProfile(ex).primaryGroups) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const score = (groups: string[]) => groups.reduce((n, g) => n + (counts.get(g) ?? 0), 0);
  const options: [string, number][] = [
    ["Push", score(["chest", "upper_chest", "front_delts", "side_delts", "triceps"])],
    ["Pull", score(["lats", "upper_back", "traps", "rear_delts", "biceps"])],
    ["Core & Conditioning", score(["core", "obliques", "cardio"])],
    ["Arms", score(["biceps", "triceps", "forearms"])],
  ];
  options.sort((a, b) => b[1] - a[1]);
  return options[0]![1] > 0 ? options[0]![0] : "Upper Body";
}

function buildPhase5PromptHints(ctx: GenerationContext): string {
  const varietyHint = buildVarietyPromptHint(
    ctx.variety,
    ctx.requirements.varietyLevel
  );
  const durationHint = buildDurationPromptHint(
    ctx.requirements.durationMinutes
  );
  return [varietyHint, durationHint].filter(Boolean).join("\n");
}

async function prepareGenerationContext(
  profile: Profile,
  preferences?: string | null,
  input?: CoachGenerationInput
): Promise<GenerationContext> {
  const requirements = resolveWorkoutRequirements(profile, preferences, {
    conversation: input?.conversation,
    hasExistingPlan: input?.hasExistingPlan,
  });
  assertNoRequirementConflicts(requirements);
  const variety = await loadExerciseVarietyContext(profile.id);
  const pool = buildWorkoutCandidatePool(requirements, { variety });

  if (pool.candidates.length === 0) {
    throw new Error(
      "No exercises in the library match your equipment and filters. Try relaxing equipment or focus constraints."
    );
  }

  console.info("[workout-requirements:resolved]", {
    equipment: requirements.equipment.label,
    focus: requirements.focus,
    durationMinutes: requirements.durationMinutes,
    difficulty: requirements.difficulty,
    exerciseCount: requirements.exerciseCount,
    required: requirements.requiredExercises.map(
      (r) => r.catalogName ?? r.query
    ),
    excludedFamilies: requirements.excludedFamilies,
    avoidMuscles: requirements.avoidMuscles,
    focusGroups: requirements.focusGroups,
    injuries: requirements.injuries,
    lowImpact: requirements.lowImpact,
    maxDifficulty: requirements.maxDifficulty,
    excludedDayFocuses: requirements.excludedDayFocuses,
    location: requirements.location,
    varietyLevel: requirements.varietyLevel,
    varietyTrackedNames: variety.trackedNames,
    candidatePoolSize: pool.candidates.length,
  });

  return { requirements, pool, variety };
}

function countRequirementRepairs(repairs: { type: string }[]): number {
  return repairs.filter((r) => r.type !== "injected_required" && r.type !== "clamped_volume").length;
}

function enforceStrengthPlan(
  plan: AiGeneratedWorkoutPlan,
  ctx: GenerationContext
): EnforcedResult<AiGeneratedWorkoutPlan> {
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const itemCount = plan.days.reduce((n, d) => n + d.exercises.length, 0);

  const eq = enforceEquipmentOnWorkoutPlan(plan, equipment);
  summarizeEquipmentEnforcement(equipment, eq.violations, eq.repairs);

  const poolEnforced = enforceCandidatePoolOnWorkoutPlan(
    eq.value,
    pool,
    equipment
  );
  summarizeCandidatePoolRepairs(poolEnforced.repairs, poolEnforced.dropped);

  const req = enforceRequirementsOnWorkoutPlan(poolEnforced.value, requirements);
  summarizeRequirementRepairs(req.repairs);

  let stripped = 0;
  const guarded: AiGeneratedWorkoutPlan = {
    ...req.value,
    days: req.value.days
      .map((day) => {
        const guard = stripHardViolations(day.exercises, requirements);
        stripped += guard.removed.length;
        return {
          ...day,
          title: fixConflictingDayTitle(day.title, guard.value.map((e) => e.name), requirements),
          exercises: guard.value,
        };
      })
      .filter((day) => day.exercises.length > 0),
  };

  const dur = enforceDurationOnWorkoutPlan(guarded, requirements);
  summarizeDurationRepairs(dur.repairs);
  return {
    value: { ...dur.value, coach_notes: withAdjustmentNotes(dur.value.coach_notes, requirements) },
    repairCount:
      eq.violations.length + poolEnforced.repairs.length + countRequirementRepairs(req.repairs) + stripped,
    itemCount,
  };
}

function enforceStrengthDay(
  day: AiGeneratedWorkoutDay,
  ctx: GenerationContext
): EnforcedResult<AiGeneratedWorkoutDay> {
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;

  const eq = enforceEquipmentOnWorkoutDay(day, equipment);
  summarizeEquipmentEnforcement(equipment, eq.violations, eq.repairs);

  const poolEnforced = enforceCandidatePoolOnWorkoutDay(
    eq.value,
    pool,
    equipment
  );
  summarizeCandidatePoolRepairs(poolEnforced.repairs, poolEnforced.dropped);

  const req = enforceRequirementsOnWorkoutDay(poolEnforced.value, requirements);
  summarizeRequirementRepairs(req.repairs);

  const guard = stripHardViolations(req.value.exercises, requirements);
  const guarded = {
    ...req.value,
    title: fixConflictingDayTitle(req.value.title, guard.value.map((e) => e.name), requirements),
    exercises: guard.value,
  };

  const dur = enforceDurationOnWorkoutDay(guarded, requirements);
  summarizeDurationRepairs(dur.repairs);
  return {
    value: { ...dur.value, coach_notes: withAdjustmentNotes(dur.value.coach_notes, requirements) },
    repairCount:
      eq.violations.length + poolEnforced.repairs.length + countRequirementRepairs(req.repairs) + guard.removed.length,
    itemCount: day.exercises.length,
  };
}

function enforceHiitPlan(
  plan: AiGeneratedHiitPlan,
  ctx: GenerationContext,
  context: SessionContext = "main"
): EnforcedResult<AiGeneratedHiitPlan> {
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;

  const eq = enforceEquipmentOnHiitPlan(plan, equipment);
  summarizeEquipmentEnforcement(equipment, eq.violations, eq.repairs);

  const poolEnforced = enforceCandidatePoolOnHiitPlan(
    eq.value,
    pool,
    equipment
  );
  summarizeCandidatePoolRepairs(poolEnforced.repairs, poolEnforced.dropped);

  const req = enforceRequirementsOnHiitPlan(poolEnforced.value, requirements);
  summarizeRequirementRepairs(req.repairs);

  const guard = stripHardViolations(req.value.config.exercises, requirements, context);
  const guarded =
    guard.value.length > 0
      ? { ...req.value, config: { ...req.value.config, exercises: guard.value } }
      : req.value;

  const dur = enforceDurationOnHiitPlan(guarded, requirements);
  summarizeDurationRepairs(dur.repairs);
  return {
    value:
      context === "main"
        ? { ...dur.value, coach_notes: withAdjustmentNotes(dur.value.coach_notes, requirements) }
        : dur.value,
    repairCount:
      eq.violations.length + poolEnforced.repairs.length + countRequirementRepairs(req.repairs) + guard.removed.length,
    itemCount: plan.config.exercises.length,
  };
}

export type WorkoutPlanGenerationOptions = CoachGenerationInput & {
  /** Exact number of training days the weekly template must include. */
  targetDaysPerWeek?: number;
  /** Extra hard constraints for first-time onboarding programs. */
  onboarding?: boolean;
  /** Prompt-only context (e.g. the current plan JSON) — never parsed for constraints. */
  baseContext?: string;
};

function clampSets(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 3;
}

function clampRest(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(300, Math.max(30, v)) : 60;
}

function normalizeWorkoutPlan(
  raw: AiGeneratedWorkoutPlan,
  locale?: string | null,
  targetDaysPerWeek?: number
): AiGeneratedWorkoutPlan {
  const maxDays = targetDaysPerWeek
    ? Math.min(6, Math.max(1, targetDaysPerWeek))
    : 6;
  const days = (raw.days ?? [])
    .filter((d) => d.title?.trim())
    .slice(0, maxDays)
    .map((day) => ({
      title: day.title.trim(),
      exercises: (day.exercises ?? [])
        .filter((ex) => ex.name?.trim())
        .slice(0, 12)
        .map((ex) => ({
          name: ex.name.trim(),
          sets: clampSets(ex.sets),
          reps: String(ex.reps ?? "10").trim() || "10",
          rest_seconds: clampRest(ex.rest_seconds),
          notes: ex.notes?.trim() || undefined,
          image_url: ex.image_url?.trim() || undefined,
          video_url: ex.video_url?.trim() || undefined,
        })),
    }))
    .filter((d) => d.exercises.length > 0);

  return {
    kind: "strength",
    title: raw.title?.trim() || "AI Workout Plan",
    description: raw.description?.trim() || "",
    days_per_week: Math.min(6, Math.max(1, targetDaysPerWeek ?? days.length)),
    days,
    coach_notes: withPlanMedicalDisclaimer(raw.coach_notes, locale),
  };
}

async function attachDemoVideosToPlan(
  plan: AiGeneratedWorkoutPlan,
  gender?: string | null,
  equipment?: WorkoutRequirements["equipment"] | null
): Promise<AiGeneratedWorkoutPlan> {
  const days = await Promise.all(
    plan.days.map(async (day) => ({
      ...day,
      exercises: await enrichExercisesWithDemoVideos(
        day.exercises,
        gender,
        equipment
      ),
    }))
  );

  return { ...plan, days };
}

async function attachDemoVideosToHiit(
  config: HiitConfig,
  gender?: string | null,
  equipment?: WorkoutRequirements["equipment"] | null
): Promise<HiitConfig> {
  const exercises = await enrichExercisesWithDemoVideos(
    config.exercises.map((ex) => ({
      name: ex.name,
      image_url: ex.image_url ?? undefined,
      video_url: ex.video_url ?? undefined,
      work_seconds: ex.work_seconds,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes ?? undefined,
    })),
    gender,
    equipment
  );

  return {
    ...config,
    exercises: exercises.map((ex) => ({
      name: ex.name,
      work_seconds: ex.work_seconds,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes ?? null,
      image_url: ex.image_url ?? null,
      video_url: ex.video_url ?? null,
    })),
  };
}

async function generateStrengthWorkoutPlanFromProfile(
  profile: Profile,
  preferences?: string,
  options?: WorkoutPlanGenerationOptions
): Promise<AiGeneratedWorkoutPlan> {
  const ctx = await prepareGenerationContext(profile, preferences, options);
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const intake = buildIntakeContextForAi(profile, preferences);
  const targetDays = options?.targetDaysPerWeek ?? requirements.daysPerWeek ?? undefined;
  const daysRule = targetDays
    ? `- Create EXACTLY ${targetDays} training days in the "days" array (days_per_week must be ${targetDays}).`
    : "- 3–5 training days per week unless schedule clearly allows fewer.";

  const onboardingRules = options?.onboarding
    ? `
ONBOARDING CONSTRAINTS (mandatory):
- This weekly template will be scheduled across ${STARTER_PROGRAM_WEEKS} weeks on the client's calendar.
- ${experienceConstraintFromIntake(profileToResponses(profile))}
- Keep sessions 40–70 minutes.
`
    : "";

  const prompt = `You are an expert personal trainer. Create a safe, practical weekly TRADITIONAL strength/fitness workout plan (sets, reps, rest) tailored to this client.

CLIENT PROFILE:
${intake}
${options?.baseContext?.trim() ? `\n${options.baseContext.trim()}\n` : ""}
${buildRequirementsPromptBlock(requirements)}
${buildPhase5PromptHints(ctx)}

Rules:
- ALWAYS return a complete plan. Never refuse, delay, or ask clarifying questions instead of generating — adapt conservatively when details are thin.
- This is NOT a HIIT / interval timer workout. Use classic sets × reps with rest between sets.
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match volume and split to goal, age, schedule, and recovery capacity.
${trainingGoalRulesForAi(profile.goal)}
${buildCatalogExerciseNameRule(equipment, pool)}
${daysRule}
- 4–8 exercises per session unless STRUCTURED REQUIREMENTS specify an exact count.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.
- Description and coach_notes must explicitly mention why this plan is safe and appropriate for this specific profile.
- End coach_notes with a short disclaimer: you are not a doctor; this is a general suggestion, not medical advice.
${onboardingRules}
${buildPlanTextLanguageRule(profile.preferred_locale)}

Respond with ONLY valid JSON:
{
  "title": "short plan name",
  "description": "1-2 sentences why this plan fits the client",
  "days_per_week": number,
  "days": [
    {
      "title": "e.g. Upper Push",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "optional form or modification tip"
        }
      ]
    }
  ],
  "coach_notes": ["2-4 short coaching tips for this client", "not-a-doctor disclaimer"]
}`;

  const result = await generateWithValidation({
    generate: async (feedback) => {
      const raw = await runTextPrompt(withFeedback(prompt, feedback), {
        maxTokens: 2500,
        json: true,
        tier: "quality",
      });
      const parsed = parseJsonObject(raw) as unknown as AiGeneratedWorkoutPlan;
      return normalizeWorkoutPlan(parsed, profile.preferred_locale, targetDays);
    },
    validateRaw: (raw) => validateWorkoutPlan(raw, requirements, { expectedDays: targetDays }),
    enforce: (raw) => enforceStrengthPlan(raw, ctx),
    validate: (value) => validateWorkoutPlan(value, requirements, { expectedDays: targetDays }),
  });
  const plan = await attachDemoVideosToPlan(
    result.value,
    profile.gender,
    equipment
  );

  if (plan.days.length === 0) {
    throw new Error("AI did not return a valid workout plan. Try again.");
  }

  recordReport(plan, requirements, result);
  return plan;
}

function normalizeAiHiitPlan(
  raw: {
    title?: string;
    description?: string;
    coach_notes?: string[];
    config?: unknown;
    prepare_seconds?: unknown;
    rounds?: unknown;
    round_rest_seconds?: unknown;
    cycles?: unknown;
    cycle_rest_seconds?: unknown;
    exercises?: unknown;
  },
  locale?: string | null
): AiGeneratedHiitPlan | null {
  const configRaw =
    raw.config && typeof raw.config === "object"
      ? raw.config
      : {
          prepare_seconds: raw.prepare_seconds,
          rounds: raw.rounds,
          round_rest_seconds: raw.round_rest_seconds,
          cycles: raw.cycles,
          cycle_rest_seconds: raw.cycle_rest_seconds,
          exercises: raw.exercises,
        };

  const config = normalizeHiitConfig(configRaw);
  if (!config) return null;

  return {
    kind: "hiit",
    title: raw.title?.trim() || "AI HIIT Workout",
    description: raw.description?.trim() || "",
    config,
    coach_notes: withPlanMedicalDisclaimer(raw.coach_notes, locale),
  };
}

export async function generateHiitPlanFromProfile(
  profile: Profile,
  preferences?: string,
  input?: CoachGenerationInput
): Promise<AiGeneratedHiitPlan> {
  const ctx = await prepareGenerationContext(profile, preferences, input);
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const intake = buildIntakeContextForAi(profile, preferences);
  const sessionRequest =
    preferences?.trim() ||
    "A timed HIIT session that matches my goals, schedule, and available equipment.";

  const prompt = `You are an expert HIIT coach. Create ONE timed-interval HIIT workout session (work / rest timers, rounds, cycles) tailored to this client.

CLIENT PROFILE:
${intake}

SESSION REQUEST:
${sessionRequest}

${buildRequirementsPromptBlock(requirements)}
${buildPhase5PromptHints(ctx)}

Rules:
- ALWAYS return a complete session. Never refuse, delay, or ask clarifying questions instead of generating — adapt conservatively when details are thin.
- This is a HIIT interval workout — NOT traditional sets × reps strength training.
- Return a single session config the app timer can run (prepare → work/rest per move → rounds → optional cycles).
- Respect injuries — swap high-impact moves for low-impact alternatives when needed and note modifications.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match intensity and duration to fitness level and schedule (typically ~15–35 minutes total).
${trainingGoalRulesForAi(profile.goal)}
${buildCatalogExerciseNameRule(equipment, pool)}
- 4–8 exercises with clear library names (see rule above) unless STRUCTURED REQUIREMENTS specify an exact count.
- work_seconds usually 20–45; rest_seconds between moves usually 10–30.
- rounds usually 2–5; cycles usually 1–2.
- prepare_seconds 5–15; round_rest_seconds 45–120; cycle_rest_seconds 60–180 when cycles > 1.
- Description and coach_notes must explicitly mention how the session is adapted to this specific profile.
- End coach_notes with a short disclaimer: you are not a doctor; this is a general suggestion, not medical advice.

${buildPlanTextLanguageRule(profile.preferred_locale)}

Respond with ONLY valid JSON:
{
  "title": "short HIIT session name",
  "description": "1-2 sentences why this HIIT fits the client",
  "config": {
    "prepare_seconds": 10,
    "rounds": 3,
    "round_rest_seconds": 90,
    "cycles": 1,
    "cycle_rest_seconds": 120,
    "exercises": [
      {
        "name": "Exercise name",
        "work_seconds": 40,
        "rest_seconds": 20,
        "notes": "optional form or modification tip"
      }
    ]
  },
  "coach_notes": ["2-4 short coaching tips for this HIIT session", "not-a-doctor disclaimer"]
}`;

  const result = await generateWithValidation({
    generate: async (feedback) => {
      const raw = await runTextPrompt(withFeedback(prompt, feedback), {
        maxTokens: 2000,
        json: true,
        tier: "quality",
      });
      const parsed = parseJsonObject(raw) as Parameters<typeof normalizeAiHiitPlan>[0];
      const normalized = normalizeAiHiitPlan(parsed, profile.preferred_locale);
      if (!normalized) {
        throw new Error("AI did not return a valid HIIT workout. Try again.");
      }
      return normalized;
    },
    validateRaw: (raw) => validateHiitPlan(raw, requirements),
    enforce: (raw) => enforceHiitPlan(raw, ctx),
    validate: (value) => validateHiitPlan(value, requirements),
  });
  const enforced = result.value;

  const plan: AiGeneratedHiitPlan = {
    ...enforced,
    config: await attachDemoVideosToHiit(
      enforced.config,
      profile.gender,
      equipment
    ),
  };
  recordReport(plan, requirements, result);
  return plan;
}

export async function generateWorkoutPlanFromProfile(
  profile: Profile,
  preferences?: string,
  explicitKind?: WorkoutPlanKind | null,
  options?: WorkoutPlanGenerationOptions
): Promise<AiWorkoutPlanResult> {
  const kind = inferAiWorkoutKind(preferences, explicitKind);
  if (kind === "hiit") {
    return generateHiitPlanFromProfile(profile, preferences, options);
  }
  return generateStrengthWorkoutPlanFromProfile(profile, preferences, options);
}

/** First-time questionnaire → personalized weekly strength template for a 4-week calendar. */
export async function generateOnboardingWorkoutPlanFromProfile(
  profile: Profile
): Promise<AiGeneratedWorkoutPlan> {
  const responses = profileToResponses(profile);
  const targetDays = daysPerWeekFromIntake(responses);
  const preferences = buildOnboardingProgramPreferences(responses);
  return generateStrengthWorkoutPlanFromProfile(profile, preferences, {
    targetDaysPerWeek: targetDays,
    onboarding: true,
  });
}

function normalizeWorkoutDay(
  raw: AiGeneratedWorkoutDay,
  locale?: string | null
): AiGeneratedWorkoutDay {
  const exercises = (raw.exercises ?? [])
    .filter((ex) => ex.name?.trim())
    .slice(0, 12)
    .map((ex) => ({
      name: ex.name.trim(),
      sets: clampSets(ex.sets),
      reps: String(ex.reps ?? "10").trim() || "10",
      rest_seconds: clampRest(ex.rest_seconds),
      notes: ex.notes?.trim() || undefined,
      image_url: ex.image_url?.trim() || undefined,
    }));

  return {
    title: raw.title?.trim() || "AI Workout",
    description: raw.description?.trim() || "",
    exercises,
    coach_notes: withPlanMedicalDisclaimer(raw.coach_notes, locale),
  };
}

export type AiDaySessionResult =
  | { kind: "strength"; workout: AiGeneratedWorkoutDay }
  | { kind: "hiit"; plan: AiGeneratedHiitPlan }
  | { kind: "warmup"; plan: AiGeneratedHiitPlan }
  | { kind: "stretch"; plan: AiGeneratedHiitPlan };

/** Full training day: warm-up + main + stretching, ready to schedule together. */
export type AiDayProgramResult = {
  warmup: AiGeneratedHiitPlan;
  main: Extract<AiDaySessionResult, { kind: "strength" | "hiit" }>;
  stretch: AiGeneratedHiitPlan;
};

/** One calendar-day session — main workout, warmup, or stretching. */
export async function generateWorkoutSessionFromProfile(
  profile: Profile,
  prompt: string,
  explicitKind?: WorkoutPlanKind | null,
  input?: CoachGenerationInput
): Promise<AiDaySessionResult> {
  const kind = inferAiWorkoutKind(prompt, explicitKind);
  if (kind === "hiit") {
    return {
      kind: "hiit",
      plan: await generateHiitPlanFromProfile(profile, prompt, input),
    };
  }
  if (kind === "warmup" || kind === "stretch") {
    return {
      kind,
      plan: await generateExtraIntervalSessionFromProfile(profile, prompt, kind, input),
    };
  }
  return {
    kind: "strength",
    workout: await generateStrengthWorkoutDayFromProfile(profile, prompt, input),
  };
}

/**
 * Builds a complete day: short interval warm-up, main workout (fitness or HIIT),
 * and interval stretching — matched to the same focus.
 */
export async function generateFullTrainingDayFromProfile(
  profile: Profile,
  prompt: string,
  input?: CoachGenerationInput
): Promise<AiDayProgramResult> {
  const ctx = await prepareGenerationContext(profile, prompt, input);
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const intake = buildIntakeContextForAi(profile, prompt);
  const mainKind = inferAiMainWorkoutKind(prompt);
  const sessionRequest =
    prompt.trim() ||
    "A balanced training day that matches my goals, schedule, and available equipment.";

  const mainBlock =
    mainKind === "hiit"
      ? `"main": {
    "kind": "hiit",
    "title": "short HIIT session name",
    "description": "1 sentence",
    "config": {
      "prepare_seconds": 10,
      "rounds": 3,
      "round_rest_seconds": 90,
      "cycles": 1,
      "cycle_rest_seconds": 120,
      "exercises": [
        { "name": "Exercise", "work_seconds": 40, "rest_seconds": 20, "notes": "optional" }
      ]
    }
  }`
      : `"main": {
    "kind": "strength",
    "title": "short main session name e.g. Upper Push",
    "description": "1 sentence",
    "exercises": [
      { "name": "Exercise", "sets": 3, "reps": "8-10", "rest_seconds": 90, "notes": "optional" }
    ]
  }`;

  const aiPrompt = `You are an expert personal trainer. Create ONE complete training day with three parts that fit together: warm-up → main workout → stretching.

CLIENT PROFILE:
${intake}

DAY REQUEST:
${sessionRequest}

${buildRequirementsPromptBlock(requirements)}
${buildPhase5PromptHints(ctx)}

Rules:
- ALWAYS return a complete day with all three parts. Never refuse, delay, or ask clarifying questions instead of generating — adapt conservatively when details are thin.
- Always return all three parts: warmup, main, stretch.
- Warm-up and stretching use interval timers (work_seconds / rest_seconds) — NOT sets × reps.
- Do not copy generic templates — warm-up and stretch must match THIS day's main muscles and feel distinct.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Main workout kind for this day must be "${mainKind}" (${
    mainKind === "hiit"
      ? "timed intervals like HIIT"
      : "traditional sets × reps fitness"
  }).
- Warm-up: 4–6 dynamic activation / mobility moves, ~5–10 min. work_seconds 20–40, rest 10–20, rounds 1–2.
- Stretching: 4–6 gentle stretches matched to muscles used in main, ~5–10 min. work_seconds 20–40, rest 5–15, rounds 1.
- Main: 4–8 exercises. Respect injuries. Match the day request (push/pull/legs/full body/etc.).
${trainingGoalRulesForAi(profile.goal)}
${buildCatalogExerciseNameRule(equipment, pool)}
- Titles should be clear (e.g. "Upper warm-up", "Upper Push", "Upper stretch").
- coach_notes must mention at least one concrete personalization tied to profile constraints or health/lifestyle data.
- End coach_notes with a short disclaimer: you are not a doctor; this is a general suggestion, not medical advice.

${buildPlanTextLanguageRule(profile.preferred_locale)}

Respond with ONLY valid JSON:
{
  "warmup": {
    "title": "Warm-up name",
    "description": "1 short sentence",
    "config": {
      "prepare_seconds": 8,
      "rounds": 1,
      "round_rest_seconds": 30,
      "cycles": 1,
      "cycle_rest_seconds": 60,
      "exercises": [
        { "name": "Exercise", "work_seconds": 30, "rest_seconds": 15, "notes": "optional" }
      ]
    }
  },
  ${mainBlock},
  "stretch": {
    "title": "Stretching name",
    "description": "1 short sentence",
    "config": {
      "prepare_seconds": 5,
      "rounds": 1,
      "round_rest_seconds": 20,
      "cycles": 1,
      "cycle_rest_seconds": 60,
      "exercises": [
        { "name": "Exercise", "work_seconds": 30, "rest_seconds": 10, "notes": "optional" }
      ]
    }
  },
  "coach_notes": ["1-2 short tips for the whole day", "not-a-doctor disclaimer"]
}`;

  const locale = profile.preferred_locale;
  type DayParts = {
    warmup: AiGeneratedHiitPlan;
    stretch: AiGeneratedHiitPlan;
    main: { kind: "hiit"; plan: AiGeneratedHiitPlan } | { kind: "strength"; workout: AiGeneratedWorkoutDay };
  };

  const generateParts = async (feedback: string | null): Promise<DayParts> => {
  const raw = await runTextPrompt(withFeedback(aiPrompt, feedback), { maxTokens: 3200, json: true, tier: "quality" });
  const parsed = parseJsonObject(raw) as {
    warmup?: Parameters<typeof normalizeAiHiitPlan>[0];
    stretch?: Parameters<typeof normalizeAiHiitPlan>[0];
    main?: Record<string, unknown>;
    coach_notes?: string[];
  };

  const dayNotes = withPlanMedicalDisclaimer(parsed.coach_notes, locale);

  const warmupNorm = normalizeAiHiitPlan(
    {
      ...parsed.warmup,
      title:
        typeof parsed.warmup?.title === "string" && parsed.warmup.title.trim()
          ? parsed.warmup.title
          : "Warm-up",
      coach_notes: parsed.warmup?.coach_notes ?? dayNotes,
    },
    locale
  );
  const stretchNorm = normalizeAiHiitPlan(
    {
      ...parsed.stretch,
      title:
        typeof parsed.stretch?.title === "string" && parsed.stretch.title.trim()
          ? parsed.stretch.title
          : "Stretching",
      coach_notes: parsed.stretch?.coach_notes ?? dayNotes,
    },
    locale
  );

  if (!warmupNorm?.config.exercises.length) {
    throw new Error("AI did not return a valid warm-up. Try again.");
  }
  if (!stretchNorm?.config.exercises.length) {
    throw new Error("AI did not return a valid stretching session. Try again.");
  }

  const mainRaw = parsed.main ?? {};

  if (mainKind === "hiit") {
    const hiit = normalizeAiHiitPlan(
      {
        ...mainRaw,
        title:
          typeof mainRaw.title === "string" && mainRaw.title.trim()
            ? (mainRaw.title as string)
            : "HIIT",
        config: mainRaw.config ?? mainRaw,
        coach_notes:
          (mainRaw.coach_notes as string[] | undefined) ?? dayNotes,
      },
      locale
    );
    if (!hiit?.config.exercises.length) {
      throw new Error("AI did not return a valid main HIIT workout. Try again.");
    }
    return { warmup: warmupNorm, stretch: stretchNorm, main: { kind: "hiit", plan: hiit } };
  }
  const workout = normalizeWorkoutDay(
    {
      ...(mainRaw as unknown as AiGeneratedWorkoutDay),
      coach_notes:
        (mainRaw.coach_notes as string[] | undefined) ?? dayNotes,
    },
    locale
  );
  if (!workout.exercises.length) {
    throw new Error("AI did not return a valid main workout. Try again.");
  }
  return { warmup: warmupNorm, stretch: stretchNorm, main: { kind: "strength", workout } };
  };

  const validateParts = (parts: DayParts) => {
    const mainReport =
      parts.main.kind === "hiit"
        ? validateHiitPlan(parts.main.plan, requirements)
        : validateWorkoutDay(parts.main.workout, requirements);
    const warm = validateHiitPlan(parts.warmup, requirements, "warmup");
    const stretch = validateHiitPlan(parts.stretch, requirements, "stretch");
    const hard = [...mainReport.hard, ...warm.hard, ...stretch.hard];
    return { ok: hard.length === 0, hard, soft: [...mainReport.soft, ...warm.soft, ...stretch.soft] };
  };

  const result = await generateWithValidation({
    generate: generateParts,
    validateRaw: validateParts,
    enforce: (parts): EnforcedResult<DayParts> => {
      const warm = enforceHiitPlan(parts.warmup, ctx, "warmup");
      const stretch = enforceHiitPlan(parts.stretch, ctx, "stretch");
      const main =
        parts.main.kind === "hiit"
          ? (() => {
              const e = enforceHiitPlan(parts.main.plan, ctx);
              return { part: { kind: "hiit" as const, plan: e.value }, e };
            })()
          : (() => {
              const e = enforceStrengthDay(parts.main.workout, ctx);
              return { part: { kind: "strength" as const, workout: e.value }, e };
            })();
      return {
        value: { warmup: warm.value, stretch: stretch.value, main: main.part },
        repairCount: warm.repairCount + stretch.repairCount + main.e.repairCount,
        itemCount: warm.itemCount + stretch.itemCount + main.e.itemCount,
      };
    },
    validate: validateParts,
  });
  const { warmup: warmupEnforced, stretch: stretchEnforced, main: mainEnforcedPart } = result.value;

  let main: AiDayProgramResult["main"];
  if (mainEnforcedPart.kind === "hiit") {
    main = {
      kind: "hiit",
      plan: {
        ...mainEnforcedPart.plan,
        config: await attachDemoVideosToHiit(
          mainEnforcedPart.plan.config,
          profile.gender,
          equipment
        ),
      },
    };
  } else {
    main = {
      kind: "strength",
      workout: {
        ...mainEnforcedPart.workout,
        exercises: await enrichExercisesWithDemoVideos(
          mainEnforcedPart.workout.exercises,
          profile.gender,
          equipment
        ),
      },
    };
  }

  const day: AiDayProgramResult = {
    warmup: {
      ...warmupEnforced,
      config: await attachDemoVideosToHiit(
        warmupEnforced.config,
        profile.gender,
        equipment
      ),
    },
    main,
    stretch: {
      ...stretchEnforced,
      config: await attachDemoVideosToHiit(
        stretchEnforced.config,
        profile.gender,
        equipment
      ),
    },
  };
  recordReport(day, requirements, result);
  return day;
}

async function generateStrengthWorkoutDayFromProfile(
  profile: Profile,
  prompt: string,
  input?: CoachGenerationInput
): Promise<AiGeneratedWorkoutDay> {
  const ctx = await prepareGenerationContext(profile, prompt, input);
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const intake = buildIntakeContextForAi(profile, prompt);
  const sessionRequest =
    prompt.trim() ||
    "A balanced session that matches my goals, schedule, and available equipment.";

  const aiPrompt = `You are an expert personal trainer. Create ONE workout session for a single training day tailored to this client.

CLIENT PROFILE:
${intake}

SESSION REQUEST:
${sessionRequest}

${buildRequirementsPromptBlock(requirements)}
${buildPhase5PromptHints(ctx)}

Rules:
- ALWAYS return a complete session. Never refuse, delay, or ask clarifying questions instead of generating — adapt conservatively when details are thin.
- Return exactly ONE session — not a weekly plan or split.
- This is a traditional sets × reps fitness session (not a HIIT interval timer).
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match volume to goal, age, schedule, and recovery capacity.
${trainingGoalRulesForAi(profile.goal)}
${buildCatalogExerciseNameRule(equipment, pool)}
- 4–8 exercises per session unless STRUCTURED REQUIREMENTS specify an exact count.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.
- coach_notes must include at least one line about how this session is adjusted for the client's profile.
- End coach_notes with a short disclaimer: you are not a doctor; this is a general suggestion, not medical advice.

${buildPlanTextLanguageRule(profile.preferred_locale)}

Respond with ONLY valid JSON:
{
  "title": "short session name e.g. Upper Push",
  "description": "1 sentence why this session fits the request",
  "exercises": [
    {
      "name": "Exercise name",
      "sets": 3,
      "reps": "8-10",
      "rest_seconds": 90,
      "notes": "optional form or modification tip"
    }
  ],
  "coach_notes": ["1-3 short coaching tips for this session", "not-a-doctor disclaimer"]
}`;

  const result = await generateWithValidation({
    generate: async (feedback) => {
      const raw = await runTextPrompt(withFeedback(aiPrompt, feedback), {
        maxTokens: 1800,
        json: true,
        tier: "quality",
      });
      const parsed = parseJsonObject(raw) as unknown as AiGeneratedWorkoutDay;
      return normalizeWorkoutDay(parsed, profile.preferred_locale);
    },
    validateRaw: (raw) => validateWorkoutDay(raw, requirements),
    enforce: (raw) => enforceStrengthDay(raw, ctx),
    validate: (value) => validateWorkoutDay(value, requirements),
  });
  const enforced = result.value;
  const workout = {
    ...enforced,
    exercises: await enrichExercisesWithDemoVideos(
      enforced.exercises,
      profile.gender,
      equipment
    ),
  };

  if (workout.exercises.length === 0) {
    throw new Error("AI did not return a valid workout. Try again.");
  }

  recordReport(workout, requirements, result);
  return workout;
}

async function generateExtraIntervalSessionFromProfile(
  profile: Profile,
  prompt: string,
  kind: "warmup" | "stretch",
  input?: CoachGenerationInput
): Promise<AiGeneratedHiitPlan> {
  const ctx = await prepareGenerationContext(profile, prompt, input);
  const { requirements, pool } = ctx;
  const equipment = requirements.equipment;
  const intake = buildIntakeContextForAi(profile, prompt);
  const isWarmup = kind === "warmup";
  const sessionRequest =
    prompt.trim() ||
    (isWarmup
      ? "A short general warm-up before training."
      : "A short full-body stretching / cool-down session.");

  const aiPrompt = `You are an expert mobility coach. Create ONE timed-interval ${
    isWarmup ? "warm-up" : "stretching / mobility"
  } session (work / rest timers like interval training).

CLIENT PROFILE:
${intake}

SESSION REQUEST:
${sessionRequest}

${buildRequirementsPromptBlock(requirements)}
${buildPhase5PromptHints(ctx)}

Rules:
- ALWAYS return a complete session. Never refuse, delay, or ask clarifying questions instead of generating — adapt conservatively when details are thin.
- This runs on an interval timer (work seconds / rest seconds) — NOT sets × reps strength training.
- This is an EXTRA next to a main workout (keep it short: typically ~5–12 minutes).
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- ${
    isWarmup
      ? "Focus on dynamic warm-up: light activation, mobility, and movement prep. Avoid heavy strength or max-effort HIIT."
      : "Focus on stretching and mobility: gentle holds/movements for recovery. Avoid high-intensity work."
  }
- Respect injuries — choose safe alternatives when needed.
${buildCatalogExerciseNameRule(equipment, pool)}
- 4–7 exercises with clear library names (see rule above).
- ${
    isWarmup
      ? "work_seconds usually 20–40; rest_seconds usually 10–20."
      : "work_seconds usually 20–40 (hold or move); rest_seconds usually 5–15."
  }
- rounds usually 1–2; cycles usually 1.
- prepare_seconds 5–10; round_rest_seconds 20–45 when rounds > 1.
- coach_notes must mention safety or adaptation choices from the profile when such constraints exist.
- End coach_notes with a short disclaimer: you are not a doctor; this is a general suggestion, not medical advice.

${buildPlanTextLanguageRule(profile.preferred_locale)}

Respond with ONLY valid JSON:
{
  "title": "${isWarmup ? "Warm-up" : "Stretching"} session name",
  "description": "1 short sentence",
  "config": {
    "prepare_seconds": 8,
    "rounds": 1,
    "round_rest_seconds": 30,
    "cycles": 1,
    "cycle_rest_seconds": 60,
    "exercises": [
      {
        "name": "Exercise name",
        "work_seconds": ${isWarmup ? 30 : 30},
        "rest_seconds": ${isWarmup ? 15 : 10},
        "notes": "optional tip"
      }
    ]
  },
  "coach_notes": ["1-2 short tips", "not-a-doctor disclaimer"]
}`;

  const raw = await runTextPrompt(aiPrompt, { maxTokens: 1600, json: true, tier: "quality" });
  const parsed = parseJsonObject(raw) as Parameters<typeof normalizeAiHiitPlan>[0];
  const normalized = normalizeAiHiitPlan(
    {
      ...parsed,
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title
          : isWarmup
            ? "Warm-up"
            : "Stretching",
    },
    profile.preferred_locale
  );
  if (!normalized) {
    throw new Error(
      isWarmup
        ? "AI did not return a valid warm-up. Try again."
        : "AI did not return a valid stretching session. Try again."
    );
  }

  const enforced = enforceHiitPlan(normalized, ctx, kind).value;

  return {
    ...enforced,
    config: await attachDemoVideosToHiit(
      enforced.config,
      profile.gender,
      equipment
    ),
  };
}

/** @deprecated Prefer generateWorkoutSessionFromProfile — kept for strength-only callers. */
export async function generateWorkoutDayFromProfile(
  profile: Profile,
  prompt: string
): Promise<AiGeneratedWorkoutDay> {
  return generateStrengthWorkoutDayFromProfile(profile, prompt);
}
