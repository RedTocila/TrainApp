import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { enrichExercisesWithDemoVideos } from "@/lib/ai/exercise-video-search";
import type { AiGeneratedWorkoutDay, AiGeneratedWorkoutPlan } from "@/lib/ai/plan-builder-types";
import type { Profile } from "@/lib/types";
import { isValidYoutubeUrl } from "@/lib/youtube";

function clampSets(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 3;
}

function clampRest(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  return Number.isFinite(v) ? Math.min(300, Math.max(30, v)) : 60;
}

function normalizeVideoUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url.trim()) return undefined;
  return isValidYoutubeUrl(url) ? url.trim() : undefined;
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
          video_url: normalizeVideoUrl(ex.video_url),
        })),
    }))
    .filter((d) => d.exercises.length > 0);

  return {
    title: raw.title?.trim() || "AI Workout Plan",
    description: raw.description?.trim() || "",
    days_per_week: Math.min(6, Math.max(1, days.length)),
    days,
    coach_notes: (raw.coach_notes ?? []).filter((n) => n?.trim()).map((n) => n.trim()),
  };
}

async function attachDemoVideosToPlan(plan: AiGeneratedWorkoutPlan): Promise<AiGeneratedWorkoutPlan> {
  const days = await Promise.all(
    plan.days.map(async (day) => ({
      ...day,
      exercises: await enrichExercisesWithDemoVideos(day.exercises),
    }))
  );

  return { ...plan, days };
}

export async function generateWorkoutPlanFromProfile(
  profile: Profile,
  preferences?: string
): Promise<AiGeneratedWorkoutPlan> {
  const intake = buildIntakeContextForAi(profile, preferences);

  const prompt = `You are an expert personal trainer. Create a safe, practical weekly workout plan tailored to this client.

CLIENT PROFILE:
${intake}

Rules:
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
  const plan = await attachDemoVideosToPlan(normalizeWorkoutPlan(parsed));

  if (plan.days.length === 0) {
    throw new Error("AI did not return a valid workout plan. Try again.");
  }

  return plan;
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
      video_url: normalizeVideoUrl(ex.video_url),
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
    exercises: await enrichExercisesWithDemoVideos(normalized.exercises),
  };

  if (workout.exercises.length === 0) {
    throw new Error("AI did not return a valid workout. Try again.");
  }

  return workout;
}
