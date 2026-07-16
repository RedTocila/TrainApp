import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { summarizeBehaviorContextForAi } from "@/lib/workout-difficulty-behavior";
import type { WorkoutDifficultyBehaviorContext } from "@/lib/workout-difficulty-behavior";
import type {
  PersonalWorkoutDifficultyResult,
  WorkoutDifficultyInput,
  WorkoutDifficultyReason,
} from "@/lib/workout-difficulty";
import type { Profile } from "@/lib/types";
import { estimateWorkoutDurationSeconds } from "@/lib/workout-duration";

function normalizeReasons(raw: unknown): WorkoutDifficultyReason[] {
  if (!Array.isArray(raw)) return [];
  const reasons: WorkoutDifficultyReason[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const impact = record.impact === "easier" ? "easier" : "harder";
    if (!id) continue;

    const params =
      record.params && typeof record.params === "object"
        ? Object.fromEntries(
            Object.entries(record.params as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ])
          )
        : undefined;

    reasons.push({ id, impact, params });
    if (reasons.length >= 12) break;
  }

  return reasons;
}

function buildExerciseSummary(exercises: WorkoutDifficultyInput[]): string {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const durationMinutes = Math.round(
    estimateWorkoutDurationSeconds(
      exercises.map((exercise) => ({ target_sets: exercise.sets }))
    ) / 60
  );
  return `${exercises.length} exercises, ${totalSets} total sets, ~${durationMinutes} min estimated duration`;
}

export async function assessWorkoutDifficultyWithAi({
  exercises,
  profile,
  behaviorContext,
  baseline,
}: {
  exercises: WorkoutDifficultyInput[];
  profile: Pick<Profile, "age" | "intake_responses" | "goal" | "gender" | "height_cm" | "intake_weight_kg" | "daily_routine" | "work_schedule" | "injuries" | "medical_conditions" | "vices" | "target_calories" | "target_protein">;
  behaviorContext?: WorkoutDifficultyBehaviorContext | null;
  baseline: PersonalWorkoutDifficultyResult;
}): Promise<PersonalWorkoutDifficultyResult | null> {
  if (exercises.length === 0) return baseline;

  const intake = buildIntakeContextForAi(profile as Profile);
  const behavior = behaviorContext
    ? summarizeBehaviorContextForAi(behaviorContext)
    : "No recent daily results available.";

  const prompt = `You are an expert coach explaining why TODAY'S workout is rated "${baseline.id}" for THIS specific client.

The rating is already fixed by the app. Do NOT change it. Your job is only to explain that rating with clear reasons.

Use ALL context below — health & lifestyle questionnaire AND recent daily behavior (workouts completed, meals logged, water, habits).

CRITICAL RULES:
- Keep the rating exactly as given: "${baseline.id}".
- Creatine, protein powder, whey, BCAAs, and similar sports supplements are NOT medications that limit recovery. They do NOT make workouts harder. Creatine may slightly HELP training capacity.
- Only prescription medications or clinical treatments (blood pressure meds, beta blockers, insulin, etc.) should count as recovery/energy limiters.
- Weight the client's ACTUAL recent consistency (workouts logged, nutrition tracking, hydration) alongside their static profile.
- Reasons must support why this workout is "${baseline.id}" for this person today.

CLIENT HEALTH & LIFESTYLE:
${intake}

RECENT DAILY RESULTS (last 7–14 days):
${behavior}

TODAY'S SESSION:
${buildExerciseSummary(exercises)}

FIXED RATING (do not change):
- Rating: ${baseline.id}
- Workout load score: ${baseline.workoutLoad}
- Capacity score: ${baseline.clientCapacity}

Respond with ONLY valid JSON:
{
  "id": "${baseline.id}",
  "workoutLoad": ${baseline.workoutLoad},
  "clientCapacity": ${baseline.clientCapacity},
  "reasons": [
    { "id": "snake_case_key", "impact": "easier" | "harder", "params": { "optional": "string values" } }
  ]
}

Use 3-8 reasons max. Reason ids should be short snake_case keys. Include params when naming specific items (supplements, meds, counts).`;

  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 900 });
    const parsed = parseJsonObject<Record<string, unknown>>(raw);
    const reasons = normalizeReasons(parsed.reasons);

    // Always keep the rule-based rating shown on the badge — AI only enriches reasons.
    return {
      id: baseline.id,
      workoutLoad: baseline.workoutLoad,
      clientCapacity: baseline.clientCapacity,
      reasons: reasons.length > 0 ? reasons : baseline.reasons,
      hasIntake: baseline.hasIntake,
    };
  } catch {
    return null;
  }
}
