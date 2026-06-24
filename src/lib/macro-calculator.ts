import type { Profile } from "@/lib/types";
import type { IntakeResponses } from "@/lib/intake-questionnaire";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroCalculationInput {
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  goal: string;
  dailyRoutine?: string | null;
  workSchedule?: string | null;
}

function activityFromText(
  dailyRoutine?: string | null,
  workSchedule?: string | null
): number {
  const text = `${workSchedule ?? ""} ${dailyRoutine ?? ""}`.toLowerCase();

  if (
    /very active|athlete|twice a day|physical job|construction|warehouse|manual labor|6\+?\s*days|double session/.test(
      text
    )
  ) {
    return 1.55;
  }
  if (
    /active|gym|workout|exercise|train|run|cycle|sport|on feet|standing|3-5|4-5|5 days/.test(
      text
    )
  ) {
    return 1.4;
  }
  if (/walk|light|1-3|moderate|part[- ]time/.test(text)) {
    return 1.3;
  }
  if (/sedentary|desk|office|sit|remote|wfh|home office|screen/.test(text)) {
    return 1.2;
  }
  return 1.25;
}

function activityFromResponses(responses: IntakeResponses): number {
  let multiplier = 1.2;

  switch (responses.job_type) {
    case "physical":
      multiplier = 1.5;
      break;
    case "standing":
      multiplier = 1.4;
      break;
    case "mixed":
      multiplier = 1.32;
      break;
    case "student":
      multiplier = 1.25;
      break;
    case "desk":
    default:
      multiplier = 1.2;
      break;
  }

  switch (responses.daily_steps) {
    case "10k_plus":
      multiplier += 0.08;
      break;
    case "6k_10k":
      multiplier += 0.04;
      break;
    case "under_3k":
      multiplier -= 0.04;
      break;
    default:
      break;
  }

  const trainingBump: Record<string, number> = {
    "0_1": 0.02,
    "2_3": 0.05,
    "4_5": 0.07,
    "6_plus": 0.09,
  };
  multiplier += trainingBump[responses.training_days_per_week ?? ""] ?? 0;

  if (responses.commute === "walk_bike") multiplier += 0.03;
  if (responses.energy_level === "low") multiplier -= 0.03;

  return Math.min(1.65, Math.max(1.15, multiplier));
}

function bmrMifflinStJeor(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: string
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "female") return base - 161;
  if (gender === "male") return base + 5;
  return base - 78;
}

function goalCalorieMultiplier(goal: string, timeline?: string): number {
  if (goal === "lose_weight") {
    switch (timeline) {
      case "1_3_months":
        return 0.78;
      case "3_6_months":
        return 0.85;
      case "6_plus_months":
        return 0.9;
      case "no_rush":
        return 0.92;
      default:
        return 0.82;
    }
  }
  switch (goal) {
    case "build_muscle":
      return 1.06;
    case "improve_endurance":
      return 1.03;
    case "general_health":
      return 0.97;
    default:
      return 1;
  }
}

function distributeMacros(
  calories: number,
  weightKg: number,
  goal: string
): Omit<MacroTargets, "calories"> {
  const proteinPerKg =
    goal === "build_muscle" || goal === "lose_weight"
      ? 2
      : goal === "improve_endurance"
        ? 1.6
        : 1.8;

  const protein = Math.round(
    Math.min(proteinPerKg * weightKg, (calories * 0.4) / 4)
  );

  const fatPct =
    goal === "lose_weight" ? 0.3 : goal === "improve_endurance" ? 0.25 : 0.28;
  const fat = Math.round((calories * fatPct) / 9);

  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    protein: Math.max(0, protein),
    carbs: Math.max(0, carbs),
    fat: Math.max(0, fat),
  };
}

export function clampTargets(targets: MacroTargets): MacroTargets {
  return {
    calories: Math.min(10000, Math.max(500, Math.round(targets.calories))),
    protein: Math.min(1000, Math.max(0, Math.round(targets.protein))),
    carbs: Math.min(2000, Math.max(0, Math.round(targets.carbs))),
    fat: Math.min(500, Math.max(0, Math.round(targets.fat))),
  };
}

export function canCalculateMacrosFromProfile(
  profile: Pick<
    Profile,
    | "age"
    | "gender"
    | "intake_weight_kg"
    | "height_cm"
    | "goal"
    | "daily_routine"
    | "work_schedule"
  >
): profile is Profile & {
  age: number;
  gender: string;
  intake_weight_kg: number;
  height_cm: number;
  goal: string;
} {
  return (
    typeof profile.age === "number" &&
    profile.age > 0 &&
    !!profile.gender &&
    typeof profile.intake_weight_kg === "number" &&
    profile.intake_weight_kg > 0 &&
    typeof profile.height_cm === "number" &&
    profile.height_cm > 0 &&
    !!profile.goal
  );
}

export function calculateMacrosFromIntake(
  input: MacroCalculationInput
): MacroTargets {
  const bmr = bmrMifflinStJeor(
    input.weightKg,
    input.heightCm,
    input.age,
    input.gender
  );
  const activity = activityFromText(
    input.dailyRoutine,
    input.workSchedule
  );
  const tdee = bmr * activity;
  const calories = Math.round(tdee * goalCalorieMultiplier(input.goal));
  const macros = distributeMacros(calories, input.weightKg, input.goal);

  return clampTargets({
    calories,
    ...macros,
  });
}

export function calculateMacrosFromIntakeResponses(
  responses: IntakeResponses
): MacroTargets | null {
  if (
    !responses.age ||
    !responses.gender ||
    !responses.intake_weight_kg ||
    !responses.height_cm ||
    !responses.goal
  ) {
    return null;
  }

  const bmr = bmrMifflinStJeor(
    responses.intake_weight_kg,
    responses.height_cm,
    responses.age,
    responses.gender
  );
  const activity = activityFromResponses(responses);
  const tdee = bmr * activity;
  const calories = Math.round(
    tdee * goalCalorieMultiplier(responses.goal, responses.goal_timeline)
  );
  const macros = distributeMacros(
    calories,
    responses.intake_weight_kg,
    responses.goal
  );

  return clampTargets({ calories, ...macros });
}

export function calculateMacrosFromProfile(
  profile: Pick<
    Profile,
    | "age"
    | "gender"
    | "intake_weight_kg"
    | "height_cm"
    | "goal"
    | "daily_routine"
    | "work_schedule"
    | "intake_responses"
  >
): MacroTargets | null {
  const responses = profile.intake_responses;
  if (responses?.age && responses.goal) {
    const fromResponses = calculateMacrosFromIntakeResponses({
      ...responses,
      age: responses.age ?? profile.age ?? undefined,
      gender: responses.gender ?? profile.gender ?? undefined,
      intake_weight_kg:
        responses.intake_weight_kg ?? profile.intake_weight_kg ?? undefined,
      height_cm: responses.height_cm ?? profile.height_cm ?? undefined,
      goal: responses.goal ?? profile.goal ?? undefined,
    });
    if (fromResponses) return fromResponses;
  }

  if (!canCalculateMacrosFromProfile(profile)) return null;

  return calculateMacrosFromIntake({
    age: profile.age,
    gender: profile.gender,
    weightKg: profile.intake_weight_kg,
    heightCm: profile.height_cm,
    goal: profile.goal,
    dailyRoutine: profile.daily_routine,
    workSchedule: profile.work_schedule,
  });
}
