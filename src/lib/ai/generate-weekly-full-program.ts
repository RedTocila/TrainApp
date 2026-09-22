import { generateFullTrainingDayFromProfile } from "@/lib/ai/generate-workout-plan";
import type { AiDayProgramResult } from "@/lib/ai/generate-workout-plan";
import { trainingGoalRulesForAi } from "@/lib/goal-coaching";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { runTextPrompt } from "@/lib/ai/providers";
import type { Profile } from "@/lib/types";
import {
  fingerprintHiitConfig,
  fingerprintStrengthExercises,
} from "@/lib/workout-content-fingerprint";

/** One training day in a weekly template: main + optional warm-up / stretch. */
export type AiWeeklyFullDay = AiDayProgramResult & {
  /** Short label e.g. "Legs", "Push" */
  focus: string;
};

/** Full weekly workout template — repeat on the calendar for N weeks. */
export type AiWeeklyFullProgram = {
  title: string;
  description: string;
  includeExtras: boolean;
  days: AiWeeklyFullDay[];
  coach_notes: string[];
};

const DEFAULT_FOCUSES: Record<number, string[]> = {
  1: ["Full body"],
  2: ["Upper body", "Lower body"],
  3: ["Push", "Pull", "Legs"],
  4: ["Push", "Pull", "Legs", "Upper / core"],
  5: ["Push", "Pull", "Legs", "Upper", "Full body / core"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
};

function focusesForGoal(goal: string | null | undefined, days: number): string[] {
  const n = Math.min(6, Math.max(1, days));
  const g = (goal ?? "").toLowerCase();
  if (g.includes("endurance") || g.includes("lose") || g.includes("fat")) {
    if (n === 3) return ["Full body A", "Full body B", "Full body C"];
    if (n === 4) return ["Upper", "Lower", "Upper", "Lower"];
  }
  if (g.includes("muscle") || g.includes("gain") || g.includes("strength")) {
    return (DEFAULT_FOCUSES[n] ?? DEFAULT_FOCUSES[4]!).slice(0, n);
  }
  return (DEFAULT_FOCUSES[n] ?? DEFAULT_FOCUSES[4]!).slice(0, n);
}

/**
 * Ask the model for day focus titles for a weekly split, then build each day
 * as warm-up → main → stretch (or main-only when includeExtras is false —
 * still generated as full day but apply can skip extras).
 */
export async function generateWeeklyFullProgramFromProfile(
  profile: Profile,
  options: {
    daysPerWeek: number;
    preferences?: string;
    includeExtras?: boolean;
    dayFocuses?: string[];
  }
): Promise<AiWeeklyFullProgram> {
  const daysPerWeek = Math.min(6, Math.max(1, Math.round(options.daysPerWeek)));
  const includeExtras = options.includeExtras !== false;
  const intake = buildIntakeContextForAi(profile, options.preferences);

  let focuses = options.dayFocuses?.filter((f) => f.trim()).slice(0, daysPerWeek);
  if (!focuses || focuses.length < daysPerWeek) {
    try {
      const raw = await runTextPrompt(
        `You are an expert personal trainer. Propose ${daysPerWeek} training-day focus titles for a weekly split.

CLIENT:
${intake}

${trainingGoalRulesForAi(profile.goal)}
${options.preferences ? `REQUEST: ${options.preferences}` : ""}

Rules:
- Return EXACTLY ${daysPerWeek} short titles (2–4 words), e.g. "Legs", "Push", "Pull", "Upper / core".
- Match the client's goal and available days. No explanations.

Respond with ONLY JSON: { "title": "plan name", "description": "1 sentence", "focuses": ["...", "..."], "coach_notes": ["tip"] }`,
        { maxTokens: 400, json: true }
      );
      const parsed = parseJsonObject<{
        title?: string;
        description?: string;
        focuses?: string[];
        coach_notes?: string[];
      }>(raw);
      if (Array.isArray(parsed.focuses) && parsed.focuses.length >= daysPerWeek) {
        focuses = parsed.focuses.map(String).slice(0, daysPerWeek);
        const days = await buildDaysInParallel(
          profile,
          focuses,
          options.preferences,
          includeExtras
        );
        return {
          title: parsed.title?.trim() || `${daysPerWeek}-day weekly program`,
          description:
            parsed.description?.trim() ||
            `Weekly template with ${daysPerWeek} training days${
              includeExtras ? " (warm-up + main + stretch each day)" : ""
            }.`,
          includeExtras,
          days,
          coach_notes: Array.isArray(parsed.coach_notes)
            ? parsed.coach_notes.map(String).slice(0, 4)
            : [],
        };
      }
    } catch {
      // fall through to defaults
    }
    focuses = focusesForGoal(profile.goal, daysPerWeek);
  }

  const days = await buildDaysInParallel(
    profile,
    focuses,
    options.preferences,
    includeExtras
  );

  return {
    title: `${daysPerWeek}-day weekly program`,
    description: `Weekly template: ${focuses.join(", ")}${
      includeExtras ? " — each day includes warm-up, main, and stretch." : ""
    }`,
    includeExtras,
    days,
    coach_notes: [],
  };
}

async function buildDaysInParallel(
  profile: Profile,
  focuses: string[],
  preferences: string | undefined,
  includeExtras: boolean
): Promise<AiWeeklyFullDay[]> {
  const results = await Promise.all(
    focuses.map(async (focus) => {
      const prompt = [
        `This is day focus "${focus}" of a ${focuses.length}-day weekly split.`,
        `Build a complete training day for: ${focus}.`,
        includeExtras
          ? "Include warm-up, main workout, and stretching matched to this focus. Exercises must be unique to this focus — do not reuse the same warm-up/stretch list from other days."
          : "Main workout is the priority; still return warm-up and stretch sections (they may be used). Keep exercises specific to this focus.",
        preferences?.trim() ? `Extra instructions: ${preferences.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const program = await generateFullTrainingDayFromProfile(profile, prompt);
      return { ...program, focus };
    })
  );
  return dedupeWeeklyDaySessions(profile, results, preferences, includeExtras);
}

function sessionFingerprints(day: AiWeeklyFullDay): string[] {
  const fps: string[] = [];
  const warmup = fingerprintHiitConfig("warmup", day.warmup.config);
  const stretch = fingerprintHiitConfig("stretch", day.stretch.config);
  if (warmup) fps.push(`warmup:${warmup}`);
  if (stretch) fps.push(`stretch:${stretch}`);
  if (day.main.kind === "hiit") {
    const hiit = fingerprintHiitConfig("hiit", day.main.plan.config);
    if (hiit) fps.push(`hiit:${hiit}`);
  } else {
    const strength = fingerprintStrengthExercises(day.main.workout.exercises);
    if (strength) fps.push(`strength:${strength}`);
  }
  return fps;
}

/** Regenerate any day whose warm-up / main / stretch matches another day. */
async function dedupeWeeklyDaySessions(
  profile: Profile,
  days: AiWeeklyFullDay[],
  preferences: string | undefined,
  includeExtras: boolean
): Promise<AiWeeklyFullDay[]> {
  const out = [...days];
  const seen = new Set<string>();

  for (let i = 0; i < out.length; i++) {
    const fps = sessionFingerprints(out[i]!);
    const clash = fps.some((fp) => seen.has(fp));
    if (!clash) {
      for (const fp of fps) seen.add(fp);
      continue;
    }

    const focus = out[i]!.focus;
    const prompt = [
      `This is day focus "${focus}" of a ${out.length}-day weekly split.`,
      `Build a complete training day for: ${focus}.`,
      "CRITICAL: Do NOT reuse exercises from other days. Pick a clearly different warm-up, main, and stretch for this focus.",
      includeExtras
        ? "Include warm-up, main workout, and stretching matched to this focus."
        : "Main workout is the priority; still return warm-up and stretch sections.",
      preferences?.trim() ? `Extra instructions: ${preferences.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const regenerated = await generateFullTrainingDayFromProfile(
        profile,
        prompt
      );
      out[i] = { ...regenerated, focus };
    } catch {
      // Keep original if regen fails — save-time dedupe still prevents library spam.
    }

    for (const fp of sessionFingerprints(out[i]!)) seen.add(fp);
  }

  return out;
}
