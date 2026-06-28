"use server";

import { addDays, format, parseISO } from "date-fns";
import { requireClient } from "@/lib/actions/auth";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import { assessWorkoutDifficultyWithAi } from "@/lib/ai/assess-workout-difficulty";
import {
  assessPersonalWorkoutDifficulty,
  type PersonalWorkoutDifficultyResult,
  type WorkoutDifficultyInput,
} from "@/lib/workout-difficulty";
import {
  buildWorkoutDifficultyBehaviorContext,
  type WorkoutDifficultyBehaviorContext,
} from "@/lib/workout-difficulty-behavior";
import { formatDateKey } from "@/lib/utils";

async function resolveBehaviorContext(
  profile: Awaited<ReturnType<typeof requireClient>>,
  behaviorContext: WorkoutDifficultyBehaviorContext | null | undefined,
  dateKey?: string
): Promise<WorkoutDifficultyBehaviorContext | null> {
  if (behaviorContext) return behaviorContext;

  const referenceDate = dateKey ?? formatDateKey(new Date());
  const from = format(addDays(parseISO(`${referenceDate}T12:00:00`), -14), "yyyy-MM-dd");
  const enrichment = await fetchDashboardEnrichmentData(profile.id, from, referenceDate);

  return buildWorkoutDifficultyBehaviorContext(enrichment, referenceDate, {
    waterGoalMl: profile.water_goal_ml,
  });
}

export async function fetchWorkoutDifficultyInsight(input: {
  exercises: WorkoutDifficultyInput[];
  behaviorContext?: WorkoutDifficultyBehaviorContext | null;
  dateKey?: string;
}): Promise<PersonalWorkoutDifficultyResult> {
  const profile = await requireClient();
  const behaviorContext = await resolveBehaviorContext(
    profile,
    input.behaviorContext,
    input.dateKey
  );

  const baseline = assessPersonalWorkoutDifficulty(
    input.exercises,
    profile,
    behaviorContext
  );

  const aiResult = await assessWorkoutDifficultyWithAi({
    exercises: input.exercises,
    profile,
    behaviorContext,
    baseline,
  });

  return aiResult ?? baseline;
}
