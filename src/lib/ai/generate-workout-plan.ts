import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi, getCriticalIntakeGaps } from "@/lib/ai/intake-context";
import { buildPlanTextLanguageRule } from "@/lib/ai/language-instructions";
import { enrichExercisesWithDemoVideos } from "@/lib/ai/exercise-video-search";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { normalizeHiitConfig, type HiitConfig, type WorkoutPlanKind } from "@/lib/hiit";
import { inferAiWorkoutKind, inferAiMainWorkoutKind } from "@/lib/ai/infer-workout-kind";
import type { Profile } from "@/lib/types";

export { inferAiWorkoutKind } from "@/lib/ai/infer-workout-kind";

function clampSets(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 3;
}

function clampRest(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(300, Math.max(30, v)) : 60;
}

function normalizeWorkoutPlan(raw: AiGeneratedWorkoutPlan): AiGeneratedWorkoutPlan {
  const days = (raw.days ?? [])
    .filter((d) => d.title?.trim())
    .slice(0, 6)
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
        })),
    }))
    .filter((d) => d.exercises.length > 0);

  return {
    kind: "strength",
    title: raw.title?.trim() || "AI Workout Plan",
    description: raw.description?.trim() || "",
    days_per_week: Math.min(6, Math.max(1, days.length)),
    days,
    coach_notes: (raw.coach_notes ?? []).filter((n) => n?.trim()).map((n) => n.trim()),
  };
}

async function attachDemoVideosToPlan(
  plan: AiGeneratedWorkoutPlan,
  gender?: string | null
): Promise<AiGeneratedWorkoutPlan> {
  const days = await Promise.all(
    plan.days.map(async (day) => ({
      ...day,
      exercises: await enrichExercisesWithDemoVideos(day.exercises, gender),
    }))
  );

  return { ...plan, days };
}

async function generateStrengthWorkoutPlanFromProfile(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedWorkoutPlan> {
  const criticalGaps = getCriticalIntakeGaps(profile);
  if (criticalGaps.length > 0) {
    throw new Error(
      `Before I build your workout plan, clarify: ${criticalGaps.join(" ")}`
    );
  }
  const intake = buildIntakeContextForAi(profile, preferences);

  const prompt = `You are an expert personal trainer. Create a safe, practical weekly TRADITIONAL strength/fitness workout plan (sets, reps, rest) tailored to this client.

CLIENT PROFILE:
${intake}

Rules:
- This is NOT a HIIT / interval timer workout. Use classic sets × reps with rest between sets.
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match volume and split to goal, age, schedule, and recovery capacity.
- Use clear exercise names (no equipment codes).
- 3–5 training days per week unless schedule clearly allows fewer.
- 4–8 exercises per session.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.
- Description and coach_notes must explicitly mention why this plan is safe and appropriate for this specific profile.

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
  "coach_notes": ["2-4 short coaching tips for this client"]
}`;

  const raw = await runTextPrompt(prompt, { maxTokens: 2500, json: true });
  const parsed = parseJsonObject(raw) as unknown as AiGeneratedWorkoutPlan;
  const plan = await attachDemoVideosToPlan(normalizeWorkoutPlan(parsed), profile.gender);

  if (plan.days.length === 0) {
    throw new Error("AI did not return a valid workout plan. Try again.");
  }

  return plan;
}

async function attachDemoVideosToHiit(
  config: HiitConfig,
  gender?: string | null
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
    gender
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

function normalizeAiHiitPlan(raw: {
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
}): AiGeneratedHiitPlan | null {
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
    coach_notes: (raw.coach_notes ?? []).filter((n) => n?.trim()).map((n) => n.trim()),
  };
}

export async function generateHiitPlanFromProfile(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedHiitPlan> {
  const criticalGaps = getCriticalIntakeGaps(profile);
  if (criticalGaps.length > 0) {
    throw new Error(
      `Before I build your HIIT plan, clarify: ${criticalGaps.join(" ")}`
    );
  }
  const intake = buildIntakeContextForAi(profile, preferences);
  const sessionRequest =
    preferences?.trim() ||
    "A timed HIIT session that matches my goals, schedule, and available equipment.";

  const prompt = `You are an expert HIIT coach. Create ONE timed-interval HIIT workout session (work / rest timers, rounds, cycles) tailored to this client.

CLIENT PROFILE:
${intake}

SESSION REQUEST:
${sessionRequest}

Rules:
- This is a HIIT interval workout — NOT traditional sets × reps strength training.
- Return a single session config the app timer can run (prepare → work/rest per move → rounds → optional cycles).
- Respect injuries — swap high-impact moves for low-impact alternatives when needed and note modifications.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match intensity and duration to fitness level and schedule (typically ~15–35 minutes total).
- 4–8 exercises with clear names.
- work_seconds usually 20–45; rest_seconds between moves usually 10–30.
- rounds usually 2–5; cycles usually 1–2.
- prepare_seconds 5–15; round_rest_seconds 45–120; cycle_rest_seconds 60–180 when cycles > 1.
- Description and coach_notes must explicitly mention how the session is adapted to this specific profile.

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
  "coach_notes": ["2-4 short coaching tips for this HIIT session"]
}`;

  const raw = await runTextPrompt(prompt, { maxTokens: 2000, json: true });
  const parsed = parseJsonObject(raw) as Parameters<typeof normalizeAiHiitPlan>[0];
  const normalized = normalizeAiHiitPlan(parsed);
  if (!normalized) {
    throw new Error("AI did not return a valid HIIT workout. Try again.");
  }

  return {
    ...normalized,
    config: await attachDemoVideosToHiit(normalized.config, profile.gender),
  };
}

export async function generateWorkoutPlanFromProfile(
  profile: Profile,
  preferences?: string,
  explicitKind?: WorkoutPlanKind | null
): Promise<AiWorkoutPlanResult> {
  const kind = inferAiWorkoutKind(preferences, explicitKind);
  if (kind === "hiit") {
    return generateHiitPlanFromProfile(profile, preferences);
  }
  return generateStrengthWorkoutPlanFromProfile(profile, preferences);
}

function normalizeWorkoutDay(raw: AiGeneratedWorkoutDay): AiGeneratedWorkoutDay {
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
    coach_notes: (raw.coach_notes ?? []).filter((n) => n?.trim()).map((n) => n.trim()),
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
  explicitKind?: WorkoutPlanKind | null
): Promise<AiDaySessionResult> {
  const kind = inferAiWorkoutKind(prompt, explicitKind);
  if (kind === "hiit") {
    return {
      kind: "hiit",
      plan: await generateHiitPlanFromProfile(profile, prompt),
    };
  }
  if (kind === "warmup" || kind === "stretch") {
    return {
      kind,
      plan: await generateExtraIntervalSessionFromProfile(profile, prompt, kind),
    };
  }
  return {
    kind: "strength",
    workout: await generateStrengthWorkoutDayFromProfile(profile, prompt),
  };
}

/**
 * Builds a complete day: short interval warm-up, main workout (fitness or HIIT),
 * and interval stretching — matched to the same focus.
 */
export async function generateFullTrainingDayFromProfile(
  profile: Profile,
  prompt: string
): Promise<AiDayProgramResult> {
  const criticalGaps = getCriticalIntakeGaps(profile);
  if (criticalGaps.length > 0) {
    throw new Error(
      `Before I build your full training day, clarify: ${criticalGaps.join(" ")}`
    );
  }
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

Rules:
- Always return all three parts: warmup, main, stretch.
- Warm-up and stretching use interval timers (work_seconds / rest_seconds) — NOT sets × reps.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Main workout kind for this day must be "${mainKind}" (${
    mainKind === "hiit"
      ? "timed intervals like HIIT"
      : "traditional sets × reps fitness"
  }).
- Warm-up: 4–6 dynamic activation / mobility moves, ~5–10 min. work_seconds 20–40, rest 10–20, rounds 1–2.
- Stretching: 4–6 gentle stretches matched to muscles used in main, ~5–10 min. work_seconds 20–40, rest 5–15, rounds 1.
- Main: 4–8 exercises. Respect injuries. Match the day request (push/pull/legs/full body/etc.).
- Titles should be clear (e.g. "Upper warm-up", "Upper Push", "Upper stretch").
- coach_notes must mention at least one concrete personalization tied to profile constraints or health/lifestyle data.

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
  "coach_notes": ["1-2 short tips for the whole day"]
}`;

  const raw = await runTextPrompt(aiPrompt, { maxTokens: 3200, json: true });
  const parsed = parseJsonObject(raw) as {
    warmup?: Parameters<typeof normalizeAiHiitPlan>[0];
    stretch?: Parameters<typeof normalizeAiHiitPlan>[0];
    main?: Record<string, unknown>;
  };

  const warmupNorm = normalizeAiHiitPlan({
    ...parsed.warmup,
    title:
      typeof parsed.warmup?.title === "string" && parsed.warmup.title.trim()
        ? parsed.warmup.title
        : "Warm-up",
  });
  const stretchNorm = normalizeAiHiitPlan({
    ...parsed.stretch,
    title:
      typeof parsed.stretch?.title === "string" && parsed.stretch.title.trim()
        ? parsed.stretch.title
        : "Stretching",
  });

  if (!warmupNorm?.config.exercises.length) {
    throw new Error("AI did not return a valid warm-up. Try again.");
  }
  if (!stretchNorm?.config.exercises.length) {
    throw new Error("AI did not return a valid stretching session. Try again.");
  }

  const mainRaw = parsed.main ?? {};
  let main: AiDayProgramResult["main"];

  if (mainKind === "hiit") {
    const hiit = normalizeAiHiitPlan({
      ...mainRaw,
      title:
        typeof mainRaw.title === "string" && mainRaw.title.trim()
          ? (mainRaw.title as string)
          : "HIIT",
      config: mainRaw.config ?? mainRaw,
    });
    if (!hiit?.config.exercises.length) {
      throw new Error("AI did not return a valid main HIIT workout. Try again.");
    }
    main = {
      kind: "hiit",
      plan: {
        ...hiit,
        config: await attachDemoVideosToHiit(hiit.config, profile.gender),
      },
    };
  } else {
    const workout = normalizeWorkoutDay(mainRaw as unknown as AiGeneratedWorkoutDay);
    if (!workout.exercises.length) {
      throw new Error("AI did not return a valid main workout. Try again.");
    }
    main = {
      kind: "strength",
      workout: {
        ...workout,
        exercises: await enrichExercisesWithDemoVideos(
          workout.exercises,
          profile.gender
        ),
      },
    };
  }

  return {
    warmup: {
      ...warmupNorm,
      config: await attachDemoVideosToHiit(warmupNorm.config, profile.gender),
    },
    main,
    stretch: {
      ...stretchNorm,
      config: await attachDemoVideosToHiit(stretchNorm.config, profile.gender),
    },
  };
}

async function generateStrengthWorkoutDayFromProfile(
  profile: Profile,
  prompt: string
): Promise<AiGeneratedWorkoutDay> {
  const criticalGaps = getCriticalIntakeGaps(profile);
  if (criticalGaps.length > 0) {
    throw new Error(
      `Before I build this workout, clarify: ${criticalGaps.join(" ")}`
    );
  }
  const intake = buildIntakeContextForAi(profile, prompt);
  const sessionRequest =
    prompt.trim() ||
    "A balanced session that matches my goals, schedule, and available equipment.";

  const aiPrompt = `You are an expert personal trainer. Create ONE workout session for a single training day tailored to this client.

CLIENT PROFILE:
${intake}

SESSION REQUEST:
${sessionRequest}

Rules:
- Return exactly ONE session — not a weekly plan or split.
- This is a traditional sets × reps fitness session (not a HIIT interval timer).
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- Match volume to goal, age, schedule, and recovery capacity.
- Use clear exercise names (no equipment codes).
- 4–8 exercises per session.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.
- coach_notes must include at least one line about how this session is adjusted for the client's profile.

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
  "coach_notes": ["1-3 short coaching tips for this session"]
}`;

  const raw = await runTextPrompt(aiPrompt, { maxTokens: 1800, json: true });
  const parsed = parseJsonObject(raw) as unknown as AiGeneratedWorkoutDay;
  const normalized = normalizeWorkoutDay(parsed);
  const workout = {
    ...normalized,
    exercises: await enrichExercisesWithDemoVideos(normalized.exercises, profile.gender),
  };

  if (workout.exercises.length === 0) {
    throw new Error("AI did not return a valid workout. Try again.");
  }

  return workout;
}

async function generateExtraIntervalSessionFromProfile(
  profile: Profile,
  prompt: string,
  kind: "warmup" | "stretch"
): Promise<AiGeneratedHiitPlan> {
  const criticalGaps = getCriticalIntakeGaps(profile);
  if (criticalGaps.length > 0) {
    throw new Error(
      `Before I build this ${kind} session, clarify: ${criticalGaps.join(" ")}`
    );
  }
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

Rules:
- This runs on an interval timer (work seconds / rest seconds) — NOT sets × reps strength training.
- This is an EXTRA next to a main workout (keep it short: typically ~5–12 minutes).
- Treat PROFILE SAFETY FLAGS as mandatory constraints. Never ignore PCOS, injuries, medications/supplements, allergies, or condition notes when present.
- ${
    isWarmup
      ? "Focus on dynamic warm-up: light activation, mobility, and movement prep. Avoid heavy strength or max-effort HIIT."
      : "Focus on stretching and mobility: gentle holds/movements for recovery. Avoid high-intensity work."
  }
- Respect injuries — choose safe alternatives when needed.
- 4–7 exercises with clear names.
- ${
    isWarmup
      ? "work_seconds usually 20–40; rest_seconds usually 10–20."
      : "work_seconds usually 20–40 (hold or move); rest_seconds usually 5–15."
  }
- rounds usually 1–2; cycles usually 1.
- prepare_seconds 5–10; round_rest_seconds 20–45 when rounds > 1.
- coach_notes must mention safety or adaptation choices from the profile when such constraints exist.

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
  "coach_notes": ["1-2 short tips"]
}`;

  const raw = await runTextPrompt(aiPrompt, { maxTokens: 1600, json: true });
  const parsed = parseJsonObject(raw) as Parameters<typeof normalizeAiHiitPlan>[0];
  const normalized = normalizeAiHiitPlan({
    ...parsed,
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title
        : isWarmup
          ? "Warm-up"
          : "Stretching",
  });
  if (!normalized) {
    throw new Error(
      isWarmup
        ? "AI did not return a valid warm-up. Try again."
        : "AI did not return a valid stretching session. Try again."
    );
  }

  return {
    ...normalized,
    config: await attachDemoVideosToHiit(normalized.config, profile.gender),
  };
}

/** @deprecated Prefer generateWorkoutSessionFromProfile — kept for strength-only callers. */
export async function generateWorkoutDayFromProfile(
  profile: Profile,
  prompt: string
): Promise<AiGeneratedWorkoutDay> {
  return generateStrengthWorkoutDayFromProfile(profile, prompt);
}
