import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { enrichExercisesWithDemoVideos } from "@/lib/ai/exercise-video-search";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { normalizeHiitConfig, type HiitConfig, type WorkoutPlanKind } from "@/lib/hiit";
import type { Profile } from "@/lib/types";

function clampSets(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 3;
}

function clampRest(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(300, Math.max(30, v)) : 60;
}

/**
 * Prefer an explicit kind from the UI/tool.
 * Otherwise detect HIIT from preferences; default to traditional strength.
 */
export function inferAiWorkoutKind(
  preferences?: string,
  explicit?: WorkoutPlanKind | null
): WorkoutPlanKind {
  if (explicit === "hiit" || explicit === "strength") return explicit;
  const text = (preferences ?? "").toLowerCase();
  if (!text.trim()) return "strength";

  const wantsHiit =
    /\b(hiit|high[\s-]?intensity(\s+interval)?(\s+training)?|tabata|interval\s*training|timed\s*intervals?|circuit\s*timer)\b/i.test(
      text
    );
  if (!wantsHiit) return "strength";

  const wantsTraditional =
    /\b(traditional|strength\s*training|hypertrophy|bodybuilding|powerlifting|sets?\s*(and|&|\/)\s*reps?)\b/i.test(
      text
    ) && !/\b(hiit|tabata)\b/i.test(text);
  if (wantsTraditional) return "strength";

  return "hiit";
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
  const intake = buildIntakeContextForAi(profile, preferences);

  const prompt = `You are an expert personal trainer. Create a safe, practical weekly TRADITIONAL strength/fitness workout plan (sets, reps, rest) tailored to this client.

CLIENT PROFILE:
${intake}

Rules:
- This is NOT a HIIT / interval timer workout. Use classic sets × reps with rest between sets.
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Match volume and split to goal, age, schedule, and recovery capacity.
- Use clear exercise names (no equipment codes).
- 3–5 training days per week unless schedule clearly allows fewer.
- 4–8 exercises per session.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.

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
  const intake = buildIntakeContextForAi(profile, preferences);

  const prompt = `You are an expert HIIT coach. Create ONE timed-interval HIIT workout session (work / rest timers, rounds, cycles) tailored to this client.

CLIENT PROFILE:
${intake}

Rules:
- This is a HIIT interval workout — NOT traditional sets × reps strength training.
- Return a single session config the app timer can run (prepare → work/rest per move → rounds → optional cycles).
- Respect injuries — swap high-impact moves for low-impact alternatives when needed and note modifications.
- Match intensity and duration to fitness level and schedule (typically ~15–35 minutes total).
- 4–8 exercises with clear names.
- work_seconds usually 20–45; rest_seconds between moves usually 10–30.
- rounds usually 2–5; cycles usually 1–2.
- prepare_seconds 5–15; round_rest_seconds 45–120; cycle_rest_seconds 60–180 when cycles > 1.

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

export async function generateWorkoutDayFromProfile(
  profile: Profile,
  prompt: string
): Promise<AiGeneratedWorkoutDay> {
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
- If they asked for HIIT/intervals, still return traditional sets × reps for this one-off calendar slot (full HIIT timer plans are built from the AI workout plan builder). Prefer metabolic / conditioning-style exercises with shorter rests.
- Respect injuries and medical conditions — avoid aggravating movements and suggest alternatives in notes.
- Match volume to goal, age, schedule, and recovery capacity.
- Use clear exercise names (no equipment codes).
- 4–8 exercises per session.
- Sets: 2–5, reps as ranges like "8-10" or "12-15", rest 45–120 seconds.

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
