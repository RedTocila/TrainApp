import {
  ACTIVITY_OPTIONS,
  HEALTH_CONDITION_OPTIONS,
  INJURY_AREA_OPTIONS,
  profileToResponses,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import {
  analyzeMedicationsSupplements,
  hasMeaningfulMedicationConcern,
} from "@/lib/medication-supplement-utils";
import type { WorkoutDifficultyBehaviorContext } from "@/lib/workout-difficulty-behavior";
import type { Profile } from "@/lib/types";
import { estimateWorkoutDurationSeconds } from "@/lib/workout-duration";

export type PersonalWorkoutDifficultyId = "easy" | "intermediate" | "hard" | "impossible";

export type WorkoutDifficultyInput = {
  sets: number;
};

export type WorkoutDifficultyReason = {
  id: string;
  impact: "easier" | "harder";
  params?: Record<string, string>;
};

export type PersonalWorkoutDifficultyResult = {
  id: PersonalWorkoutDifficultyId;
  workoutLoad: number;
  clientCapacity: number;
  reasons: WorkoutDifficultyReason[];
  hasIntake: boolean;
};

function labelFor(
  options: { value: string; label: string }[],
  value?: string
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

function labelsFor(options: { value: string; label: string }[], values?: string[]): string {
  if (!values?.length) return "";
  return values
    .filter((value) => value !== "none")
    .map((value) => labelFor(options, value) ?? value)
    .join(", ");
}

export function getWorkoutLoadScore(exercises: WorkoutDifficultyInput[]): number {
  if (exercises.length === 0) return 0;

  const exerciseCount = exercises.length;
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const durationMinutes =
    estimateWorkoutDurationSeconds(
      exercises.map((exercise) => ({ target_sets: exercise.sets }))
    ) / 60;

  return Math.round(
    Math.min(exerciseCount * 7, 28) +
      Math.min(totalSets * 1.8, 36) +
      Math.min(durationMinutes * 0.75, 36)
  );
}

function applyIntakeCapacityAdjustments(
  responses: IntakeResponses,
  age: number | null | undefined,
  reasons: WorkoutDifficultyReason[]
): number {
  let capacity = 50;

  if (responses.training_experience === "beginner") {
    capacity -= 14;
    reasons.push({ id: "beginnerExperience", impact: "harder" });
  } else if (responses.training_experience === "intermediate") {
    capacity += 4;
    reasons.push({ id: "intermediateExperience", impact: "easier" });
  } else if (responses.training_experience === "advanced") {
    capacity += 14;
    reasons.push({ id: "advancedExperience", impact: "easier" });
  }

  if (responses.training_days_per_week === "0_1") {
    capacity -= 12;
    reasons.push({ id: "lowTrainingFrequency", impact: "harder" });
  } else if (
    responses.training_days_per_week === "4_5" ||
    responses.training_days_per_week === "6_plus"
  ) {
    capacity += 10;
    reasons.push({ id: "highTrainingFrequency", impact: "easier" });
  }

  const injuries = responses.injury_areas?.filter((area) => area !== "none") ?? [];
  if (injuries.length > 0) {
    capacity -= 8 + injuries.length * 4;
    reasons.push({
      id: "injuries",
      impact: "harder",
      params: { areas: labelsFor(INJURY_AREA_OPTIONS, injuries) },
    });
  }

  if (responses.injury_details?.trim()) {
    capacity -= 4;
    reasons.push({ id: "injuryDetails", impact: "harder" });
  }

  const conditions =
    responses.health_conditions?.filter((condition) => condition !== "none") ?? [];
  if (conditions.length > 0) {
    capacity -= 10 + conditions.length * 3;
    reasons.push({
      id: "healthConditions",
      impact: "harder",
      params: { conditions: labelsFor(HEALTH_CONDITION_OPTIONS, conditions) },
    });
  }

  if (responses.health_condition_details?.trim()) {
    capacity -= 3;
    reasons.push({ id: "healthDetails", impact: "harder" });
  }

  if (responses.medications?.trim()) {
    const meds = analyzeMedicationsSupplements(responses.medications);
    if (meds.concerningMedications.length > 0) {
      capacity -= 4 + meds.concerningMedications.length * 2;
      reasons.push({
        id: "medicationsConcerning",
        impact: "harder",
        params: { items: meds.concerningMedications.join(", ") },
      });
    } else if (meds.unknownEntries.length > 0 && meds.performanceSupplements.length === 0) {
      capacity -= 2;
      reasons.push({
        id: "medicationsUnknown",
        impact: "harder",
        params: { items: meds.unknownEntries.join(", ") },
      });
    }
    if (meds.performanceSupplements.length > 0) {
      capacity += 2;
      reasons.push({
        id: "performanceSupplements",
        impact: "easier",
        params: { items: meds.performanceSupplements.join(", ") },
      });
    }
    if (
      meds.benignSupplements.length > 0 &&
      !hasMeaningfulMedicationConcern(meds) &&
      meds.performanceSupplements.length === 0
    ) {
      reasons.push({
        id: "benignSupplements",
        impact: "easier",
        params: { items: meds.benignSupplements.join(", ") },
      });
    }
  }

  if (age != null) {
    if (age < 16) {
      capacity -= 12;
      reasons.push({ id: "veryYoungAge", impact: "harder", params: { age: String(age) } });
    } else if (age < 18) {
      capacity -= 8;
      reasons.push({ id: "youngAge", impact: "harder", params: { age: String(age) } });
    } else if (age >= 65) {
      capacity -= 14;
      reasons.push({ id: "seniorAge", impact: "harder", params: { age: String(age) } });
    } else if (age >= 55) {
      capacity -= 8;
      reasons.push({ id: "olderAge", impact: "harder", params: { age: String(age) } });
    }
  }

  if (responses.energy_level === "low") {
    capacity -= 10;
    reasons.push({ id: "lowEnergy", impact: "harder" });
  } else if (responses.energy_level === "high") {
    capacity += 6;
    reasons.push({ id: "highEnergy", impact: "easier" });
  }

  if (responses.sleep_hours === "under_6") {
    capacity -= 8;
    reasons.push({ id: "poorSleep", impact: "harder" });
  } else if (responses.sleep_hours === "8_plus") {
    capacity += 4;
    reasons.push({ id: "goodSleep", impact: "easier" });
  }

  if (responses.stress_level === "high") {
    capacity -= 8;
    reasons.push({ id: "highStress", impact: "harder" });
  }

  if (responses.smoking === "daily") {
    capacity -= 6;
    reasons.push({ id: "smoking", impact: "harder" });
  }

  if (responses.alcohol === "daily") {
    capacity -= 4;
    reasons.push({ id: "alcohol", impact: "harder" });
  }

  if (responses.daily_steps === "under_3k") {
    capacity -= 5;
    reasons.push({ id: "lowSteps", impact: "harder" });
  }

  const activities = responses.current_activities?.filter((item) => item !== "none") ?? [];
  if (activities.length >= 2) {
    capacity += 4;
    reasons.push({
      id: "activeLifestyle",
      impact: "easier",
      params: { activities: labelsFor(ACTIVITY_OPTIONS, activities) },
    });
  }

  return Math.max(10, Math.min(90, capacity));
}

function applyBehaviorContextAdjustments(
  context: WorkoutDifficultyBehaviorContext,
  reasons: WorkoutDifficultyReason[]
): number {
  let delta = 0;

  if (context.workoutsLast7Days >= 4) {
    delta += 8;
    reasons.push({
      id: "consistentRecentTraining",
      impact: "easier",
      params: { count: String(context.workoutsLast7Days) },
    });
  } else if (context.workoutsLast7Days <= 1) {
    delta -= 6;
    reasons.push({
      id: "inconsistentRecentTraining",
      impact: "harder",
      params: { count: String(context.workoutsLast7Days) },
    });
  }

  if (context.daysWithMealsLast7Days >= 5) {
    delta += 4;
    reasons.push({
      id: "consistentMealLogging",
      impact: "easier",
      params: { count: String(context.daysWithMealsLast7Days) },
    });
  } else if (context.daysWithMealsLast7Days <= 2) {
    delta -= 3;
    reasons.push({ id: "sparseMealLogging", impact: "harder" });
  }

  if (context.habitCompletionDaysLast7 >= 5) {
    delta += 3;
    reasons.push({
      id: "strongDailyHabits",
      impact: "easier",
      params: { count: String(context.habitCompletionDaysLast7) },
    });
  }

  const waterGoal = context.waterGoalMl ?? 2000;
  if (context.waterMlToday != null && context.waterMlToday < waterGoal * 0.45) {
    delta -= 4;
    reasons.push({ id: "lowHydrationToday", impact: "harder" });
  } else if (
    context.avgWaterMlLast3Days != null &&
    context.avgWaterMlLast3Days >= waterGoal * 0.85
  ) {
    delta += 3;
    reasons.push({ id: "goodHydration", impact: "easier" });
  }

  return delta;
}

function applyWorkoutLoadReasons(
  exercises: WorkoutDifficultyInput[],
  reasons: WorkoutDifficultyReason[]
): void {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const durationMinutes =
    estimateWorkoutDurationSeconds(
      exercises.map((exercise) => ({ target_sets: exercise.sets }))
    ) / 60;

  if (exercises.length >= 5) {
    reasons.push({
      id: "manyExercises",
      impact: "harder",
      params: { count: String(exercises.length) },
    });
  }

  if (totalSets >= 16) {
    reasons.push({
      id: "manySets",
      impact: "harder",
      params: { count: String(totalSets) },
    });
  }

  if (durationMinutes >= 50) {
    reasons.push({
      id: "longDuration",
      impact: "harder",
      params: { minutes: String(Math.round(durationMinutes)) },
    });
  } else if (durationMinutes <= 20 && exercises.length <= 3) {
    reasons.push({ id: "shortSession", impact: "easier" });
  }
}

function hasMeaningfulIntake(responses: IntakeResponses): boolean {
  return Boolean(
    responses.training_experience ||
      responses.training_days_per_week ||
      responses.energy_level ||
      responses.sleep_hours ||
      (responses.injury_areas?.length ?? 0) > 0 ||
      (responses.health_conditions?.length ?? 0) > 0
  );
}

export function assessPersonalWorkoutDifficulty(
  exercises: WorkoutDifficultyInput[],
  profile: Pick<Profile, "age" | "intake_responses"> | null | undefined,
  behaviorContext?: WorkoutDifficultyBehaviorContext | null
): PersonalWorkoutDifficultyResult {
  const workoutLoad = getWorkoutLoadScore(exercises);
  const reasons: WorkoutDifficultyReason[] = [];

  if (exercises.length === 0) {
    return {
      id: "easy",
      workoutLoad: 0,
      clientCapacity: 50,
      reasons: [],
      hasIntake: false,
    };
  }

  applyWorkoutLoadReasons(exercises, reasons);

  const responses = profile ? profileToResponses(profile as Profile) : {};
  const hasIntake = hasMeaningfulIntake(responses);
  let clientCapacity = hasIntake
    ? applyIntakeCapacityAdjustments(responses, profile?.age ?? responses.age, reasons)
    : 50;

  if (behaviorContext) {
    clientCapacity = Math.max(
      10,
      Math.min(90, clientCapacity + applyBehaviorContextAdjustments(behaviorContext, reasons))
    );
  }

  if (!hasIntake) {
    reasons.push({ id: "incompleteProfile", impact: "harder" });
  }

  const gap = workoutLoad - clientCapacity;

  let id: PersonalWorkoutDifficultyId;
  if (gap < -15) id = "easy";
  else if (gap < 8) id = "intermediate";
  else if (gap < 25) id = "hard";
  else id = "impossible";

  return {
    id,
    workoutLoad,
    clientCapacity,
    reasons,
    hasIntake,
  };
}

/** @deprecated Use assessPersonalWorkoutDifficulty */
export type WorkoutDifficultyId = PersonalWorkoutDifficultyId;

/** @deprecated Use assessPersonalWorkoutDifficulty */
export function estimateWorkoutDifficulty(
  exercises: WorkoutDifficultyInput[]
): PersonalWorkoutDifficultyId {
  return assessPersonalWorkoutDifficulty(exercises, null).id;
}
