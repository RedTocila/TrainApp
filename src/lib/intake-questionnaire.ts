import type { Profile } from "@/lib/types";
import { GOAL_LABELS, GENDER_OPTIONS } from "@/lib/intake-display";

export const INTAKE_STORAGE_KEY = "rutina-intake-draft";

export interface IntakeResponses {
  age?: number;
  gender?: string;
  height_cm?: number;
  intake_weight_kg?: number;
  goal?: string;
  goal_timeline?: string;
  training_experience?: string;
  training_days_per_week?: string;
  training_time_preference?: string;
  equipment_access?: string[];
  current_activities?: string[];
  job_type?: string;
  work_hours?: string;
  commute?: string;
  daily_steps?: string;
  sleep_hours?: string;
  wake_time?: string;
  bedtime?: string;
  energy_level?: string;
  diet_type?: string;
  meals_per_day?: string;
  cooking_frequency?: string;
  food_allergies?: string[];
  food_dislikes?: string;
  injury_areas?: string[];
  injury_details?: string;
  health_conditions?: string[];
  health_condition_details?: string;
  medications?: string;
  smoking?: string;
  alcohol?: string;
  stress_level?: string;
  water_habits?: string;
}

export interface IntakeOption {
  value: string;
  label: string;
  emoji?: string;
  description?: string;
}

export interface IntakeStep {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
}

export const INTAKE_STEPS: IntakeStep[] = [
  { id: "basics", title: "Let's meet you", subtitle: "The basics so we can size your plan", emoji: "👋" },
  { id: "goal", title: "What's the mission?", subtitle: "Where you're headed — and how fast", emoji: "🎯" },
  { id: "training", title: "How you move", subtitle: "Training history & gym access", emoji: "💪" },
  { id: "work", title: "Your day job", subtitle: "Work, commute & daily movement", emoji: "💼" },
  { id: "sleep", title: "Sleep & energy", subtitle: "Recovery fuels everything", emoji: "😴" },
  { id: "nutrition", title: "Plate preferences", subtitle: "Diet style, cooking & allergies", emoji: "🥗" },
  { id: "health", title: "Body check-in", subtitle: "Injuries & health we should respect", emoji: "🩺" },
  { id: "lifestyle", title: "Life off the gym", subtitle: "Habits that shape your results", emoji: "✨" },
];

export const GOAL_OPTIONS: IntakeOption[] = [
  { value: "lose_weight", label: "Lose weight", emoji: "🔥", description: "Fat loss with muscle retention" },
  { value: "build_muscle", label: "Build muscle", emoji: "🏋️", description: "Strength & size" },
  { value: "stay_fit", label: "Stay fit", emoji: "⚡", description: "Maintain where you are" },
  { value: "improve_endurance", label: "Improve endurance", emoji: "🏃", description: "Cardio & stamina" },
  { value: "general_health", label: "General health", emoji: "💚", description: "Feel better day to day" },
];

export const GOAL_TIMELINE_OPTIONS: IntakeOption[] = [
  { value: "1_3_months", label: "1–3 months", emoji: "🚀" },
  { value: "3_6_months", label: "3–6 months", emoji: "📈" },
  { value: "6_plus_months", label: "6+ months", emoji: "🌱" },
  { value: "no_rush", label: "No rush — lifestyle", emoji: "♾️" },
];

export const TRAINING_EXPERIENCE_OPTIONS: IntakeOption[] = [
  { value: "beginner", label: "Beginner", emoji: "🌱", description: "New or returning after a break" },
  { value: "intermediate", label: "Intermediate", emoji: "📊", description: "1–3 years consistent" },
  { value: "advanced", label: "Advanced", emoji: "🏆", description: "3+ years, structured training" },
];

export const TRAINING_DAYS_OPTIONS: IntakeOption[] = [
  { value: "0_1", label: "0–1 days", emoji: "🛋️" },
  { value: "2_3", label: "2–3 days", emoji: "👟" },
  { value: "4_5", label: "4–5 days", emoji: "🔥" },
  { value: "6_plus", label: "6+ days", emoji: "⚡" },
];

export const TRAINING_TIME_OPTIONS: IntakeOption[] = [
  { value: "morning", label: "Morning", emoji: "🌅" },
  { value: "midday", label: "Midday", emoji: "☀️" },
  { value: "evening", label: "Evening", emoji: "🌙" },
  { value: "flexible", label: "Flexible", emoji: "🔄" },
];

export const EQUIPMENT_OPTIONS: IntakeOption[] = [
  { value: "full_gym", label: "Full gym", emoji: "🏋️" },
  { value: "home_dumbbells", label: "Home weights", emoji: "🏠" },
  { value: "bodyweight", label: "Bodyweight only", emoji: "🤸" },
  { value: "outdoor", label: "Outdoor / park", emoji: "🌳" },
];

export const ACTIVITY_OPTIONS: IntakeOption[] = [
  { value: "running", label: "Running", emoji: "🏃" },
  { value: "cycling", label: "Cycling", emoji: "🚴" },
  { value: "swimming", label: "Swimming", emoji: "🏊" },
  { value: "team_sports", label: "Team sports", emoji: "⚽" },
  { value: "yoga_pilates", label: "Yoga / Pilates", emoji: "🧘" },
  { value: "none", label: "None right now", emoji: "—" },
];

export const JOB_TYPE_OPTIONS: IntakeOption[] = [
  { value: "desk", label: "Desk / office", emoji: "💻", description: "Mostly sitting" },
  { value: "mixed", label: "Mixed", emoji: "🔀", description: "Sit + move throughout day" },
  { value: "standing", label: "On your feet", emoji: "🧍", description: "Retail, teaching, etc." },
  { value: "physical", label: "Physical labor", emoji: "🔧", description: "Construction, warehouse…" },
  { value: "student", label: "Student", emoji: "📚" },
];

export const WORK_HOURS_OPTIONS: IntakeOption[] = [
  { value: "part_time", label: "Part-time", emoji: "⏱️" },
  { value: "full_time", label: "Full-time (9–5ish)", emoji: "📅" },
  { value: "shift", label: "Shift work", emoji: "🌓" },
  { value: "irregular", label: "Irregular / freelance", emoji: "🎲" },
];

export const COMMUTE_OPTIONS: IntakeOption[] = [
  { value: "wfh", label: "Work from home", emoji: "🏠" },
  { value: "drive", label: "Drive", emoji: "🚗" },
  { value: "walk_bike", label: "Walk or bike", emoji: "🚶" },
  { value: "transit", label: "Public transit", emoji: "🚌" },
];

export const DAILY_STEPS_OPTIONS: IntakeOption[] = [
  { value: "under_3k", label: "Under 3k", emoji: "🐢" },
  { value: "3k_6k", label: "3k–6k", emoji: "👟" },
  { value: "6k_10k", label: "6k–10k", emoji: "🔥" },
  { value: "10k_plus", label: "10k+", emoji: "⚡" },
];

export const SLEEP_HOURS_OPTIONS: IntakeOption[] = [
  { value: "under_6", label: "Under 6h", emoji: "😵" },
  { value: "6_7", label: "6–7h", emoji: "😴" },
  { value: "7_8", label: "7–8h", emoji: "✨" },
  { value: "8_plus", label: "8h+", emoji: "🌙" },
];

export const ENERGY_OPTIONS: IntakeOption[] = [
  { value: "low", label: "Often tired", emoji: "🔋" },
  { value: "moderate", label: "Up and down", emoji: "📊" },
  { value: "high", label: "High energy", emoji: "⚡" },
];

export const DIET_TYPE_OPTIONS: IntakeOption[] = [
  { value: "omnivore", label: "Omnivore", emoji: "🍖" },
  { value: "vegetarian", label: "Vegetarian", emoji: "🥬" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "pescatarian", label: "Pescatarian", emoji: "🐟" },
  { value: "other", label: "Other", emoji: "✏️" },
];

export const MEALS_PER_DAY_OPTIONS: IntakeOption[] = [
  { value: "2", label: "2 meals", emoji: "2️⃣" },
  { value: "3", label: "3 meals", emoji: "3️⃣" },
  { value: "4", label: "4 meals", emoji: "4️⃣" },
  { value: "5_plus", label: "5+", emoji: "5️⃣" },
];

export const COOKING_OPTIONS: IntakeOption[] = [
  { value: "rarely", label: "Rarely — mostly eat out", emoji: "🥡" },
  { value: "sometimes", label: "Sometimes", emoji: "🍳" },
  { value: "often", label: "Often", emoji: "👨‍🍳" },
  { value: "daily", label: "I cook daily", emoji: "🔥" },
];

export const ALLERGY_OPTIONS: IntakeOption[] = [
  { value: "none", label: "None", emoji: "✅" },
  { value: "dairy", label: "Dairy", emoji: "🥛" },
  { value: "gluten", label: "Gluten", emoji: "🌾" },
  { value: "nuts", label: "Nuts", emoji: "🥜" },
  { value: "shellfish", label: "Shellfish", emoji: "🦐" },
  { value: "eggs", label: "Eggs", emoji: "🥚" },
  { value: "soy", label: "Soy", emoji: "🫘" },
];

export const INJURY_AREA_OPTIONS: IntakeOption[] = [
  { value: "none", label: "None", emoji: "✅" },
  { value: "knees", label: "Knees", emoji: "🦵" },
  { value: "back", label: "Back", emoji: "🔙" },
  { value: "shoulders", label: "Shoulders", emoji: "💪" },
  { value: "hips", label: "Hips", emoji: "🦴" },
  { value: "ankles", label: "Ankles / feet", emoji: "👣" },
  { value: "wrists", label: "Wrists / elbows", emoji: "✋" },
];

export const HEALTH_CONDITION_OPTIONS: IntakeOption[] = [
  { value: "none", label: "None", emoji: "✅" },
  { value: "diabetes", label: "Diabetes", emoji: "🩸" },
  { value: "hypertension", label: "High blood pressure", emoji: "❤️" },
  { value: "asthma", label: "Asthma", emoji: "🫁" },
  { value: "pcos", label: "PCOS", emoji: "🔄" },
  { value: "thyroid", label: "Thyroid", emoji: "🦋" },
  { value: "other", label: "Other", emoji: "✏️" },
];

export const SMOKING_OPTIONS: IntakeOption[] = [
  { value: "never", label: "Never", emoji: "✅" },
  { value: "occasionally", label: "Occasionally", emoji: "🚬" },
  { value: "daily", label: "Daily", emoji: "⚠️" },
  { value: "quitting", label: "Trying to quit", emoji: "💪" },
];

export const ALCOHOL_OPTIONS: IntakeOption[] = [
  { value: "never", label: "Never / rarely", emoji: "✅" },
  { value: "social", label: "Social only", emoji: "🥂" },
  { value: "weekly", label: "A few times a week", emoji: "🍺" },
  { value: "daily", label: "Most days", emoji: "⚠️" },
];

export const STRESS_OPTIONS: IntakeOption[] = [
  { value: "low", label: "Pretty chill", emoji: "😌" },
  { value: "moderate", label: "Moderate", emoji: "📊" },
  { value: "high", label: "High stress", emoji: "😰" },
];

export const WATER_HABITS_OPTIONS: IntakeOption[] = [
  { value: "rarely", label: "I forget to drink water", emoji: "🏜️" },
  { value: "sometimes", label: "Sometimes hit 2L", emoji: "💧" },
  { value: "goal_2l", label: "Usually 2L+", emoji: "🚰" },
  { value: "goal_3l_plus", label: "3L+ daily", emoji: "🌊" },
];

const REQUIRED_RESPONSE_KEYS: { key: keyof IntakeResponses; label: string }[] = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "intake_weight_kg", label: "Weight" },
  { key: "height_cm", label: "Height" },
  { key: "goal", label: "Goal" },
  { key: "goal_timeline", label: "Timeline" },
  { key: "training_experience", label: "Training experience" },
  { key: "training_days_per_week", label: "Training days" },
  { key: "training_time_preference", label: "Workout time" },
  { key: "job_type", label: "Job type" },
  { key: "work_hours", label: "Work hours" },
  { key: "daily_steps", label: "Daily steps" },
  { key: "sleep_hours", label: "Sleep" },
  { key: "energy_level", label: "Energy level" },
  { key: "diet_type", label: "Diet type" },
  { key: "meals_per_day", label: "Meals per day" },
  { key: "cooking_frequency", label: "Cooking habits" },
  { key: "smoking", label: "Smoking" },
  { key: "alcohol", label: "Alcohol" },
  { key: "stress_level", label: "Stress" },
  { key: "water_habits", label: "Water habits" },
];

function labelFor(options: IntakeOption[], value?: string): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

function labelsFor(options: IntakeOption[], values?: string[]): string | null {
  if (!values?.length) return null;
  const filtered = values.filter((v) => v !== "none");
  if (!filtered.length) return "None";
  return filtered.map((v) => labelFor(options, v) ?? v).join(", ");
}

export function buildDailyRoutineText(responses: IntakeResponses): string {
  const parts: string[] = [];
  const wake = responses.wake_time?.trim();
  const bed = responses.bedtime?.trim();
  if (wake) parts.push(`Wake ${wake}`);
  if (bed) parts.push(`Bed ${bed}`);
  const sleep = labelFor(SLEEP_HOURS_OPTIONS, responses.sleep_hours);
  if (sleep) parts.push(`Sleep: ${sleep}`);
  const energy = labelFor(ENERGY_OPTIONS, responses.energy_level);
  if (energy) parts.push(`Energy: ${energy}`);
  const days = labelFor(TRAINING_DAYS_OPTIONS, responses.training_days_per_week);
  if (days) parts.push(`Trains ${days}/week`);
  const time = labelFor(TRAINING_TIME_OPTIONS, responses.training_time_preference);
  if (time) parts.push(`Prefers ${time.toLowerCase()} workouts`);
  const experience = labelFor(TRAINING_EXPERIENCE_OPTIONS, responses.training_experience);
  if (experience) parts.push(`Experience: ${experience}`);
  const activities = labelsFor(ACTIVITY_OPTIONS, responses.current_activities);
  if (activities) parts.push(`Activities: ${activities}`);
  const equipment = labelsFor(EQUIPMENT_OPTIONS, responses.equipment_access);
  if (equipment) parts.push(`Equipment: ${equipment}`);
  const meals = labelFor(MEALS_PER_DAY_OPTIONS, responses.meals_per_day);
  if (meals) parts.push(`${meals}/day`);
  const cooking = labelFor(COOKING_OPTIONS, responses.cooking_frequency);
  if (cooking) parts.push(`Cooking: ${cooking}`);
  const water = labelFor(WATER_HABITS_OPTIONS, responses.water_habits);
  if (water) parts.push(`Water: ${water}`);
  return parts.join(". ");
}

export function buildWorkScheduleText(responses: IntakeResponses): string {
  const parts: string[] = [];
  const job = labelFor(JOB_TYPE_OPTIONS, responses.job_type);
  if (job) parts.push(job);
  const hours = labelFor(WORK_HOURS_OPTIONS, responses.work_hours);
  if (hours) parts.push(hours);
  const commute = labelFor(COMMUTE_OPTIONS, responses.commute);
  if (commute) parts.push(`Commute: ${commute}`);
  const steps = labelFor(DAILY_STEPS_OPTIONS, responses.daily_steps);
  if (steps) parts.push(`Steps: ${steps}`);
  if (responses.job_type === "desk" || responses.commute === "wfh") {
    parts.push("sedentary desk work");
  }
  if (responses.job_type === "physical") {
    parts.push("physical job");
  }
  if (responses.daily_steps === "10k_plus") {
    parts.push("very active daily movement");
  }
  return parts.join(". ");
}

export function buildVicesText(responses: IntakeResponses): string {
  const parts: string[] = [];
  const smoking = labelFor(SMOKING_OPTIONS, responses.smoking);
  if (smoking && responses.smoking !== "never") parts.push(`Smoking: ${smoking}`);
  else if (responses.smoking === "never") parts.push("Non-smoker");
  const alcohol = labelFor(ALCOHOL_OPTIONS, responses.alcohol);
  if (alcohol) parts.push(`Alcohol: ${alcohol}`);
  const stress = labelFor(STRESS_OPTIONS, responses.stress_level);
  if (stress) parts.push(`Stress: ${stress}`);
  return parts.join(". ");
}

export function buildInjuriesText(responses: IntakeResponses): string {
  const areas = labelsFor(INJURY_AREA_OPTIONS, responses.injury_areas);
  const details = responses.injury_details?.trim();
  if (!areas && !details) return "";
  return [areas ? `Areas: ${areas}` : null, details].filter(Boolean).join(". ");
}

export function buildMedicalConditionsText(responses: IntakeResponses): string {
  const conditions = labelsFor(HEALTH_CONDITION_OPTIONS, responses.health_conditions);
  const details = responses.health_condition_details?.trim();
  const meds = responses.medications?.trim();
  return [conditions ? `Conditions: ${conditions}` : null, details, meds ? `Medications: ${meds}` : null]
    .filter(Boolean)
    .join(". ");
}

export function buildNutritionNotes(responses: IntakeResponses): string {
  const parts: string[] = [];
  const diet = labelFor(DIET_TYPE_OPTIONS, responses.diet_type);
  if (diet) parts.push(`Diet: ${diet}`);
  const allergies = labelsFor(ALLERGY_OPTIONS, responses.food_allergies);
  if (allergies) parts.push(`Allergies: ${allergies}`);
  const dislikes = responses.food_dislikes?.trim();
  if (dislikes) parts.push(`Dislikes: ${dislikes}`);
  return parts.join(". ");
}

export function responsesToProfileFields(
  responses: IntakeResponses
): Partial<Profile> & { intake_responses: IntakeResponses } {
  const daily_routine = buildDailyRoutineText(responses);
  const work_schedule = buildWorkScheduleText(responses);
  const vices = buildVicesText(responses);
  const injuries = buildInjuriesText(responses);
  const medical_conditions = [
    buildMedicalConditionsText(responses),
    buildNutritionNotes(responses),
  ]
    .filter(Boolean)
    .join(". ");

  return {
    age: responses.age ?? null,
    gender: responses.gender ?? null,
    height_cm: responses.height_cm ?? null,
    intake_weight_kg: responses.intake_weight_kg ?? null,
    goal: responses.goal ?? null,
    daily_routine: daily_routine || null,
    work_schedule: work_schedule || null,
    vices: vices || null,
    injuries: injuries || null,
    medical_conditions: medical_conditions || null,
    intake_responses: responses,
  };
}

export function profileToResponses(profile: Profile): IntakeResponses {
  const stored = profile.intake_responses ?? {};
  return {
    ...stored,
    age: stored.age ?? profile.age ?? undefined,
    gender: stored.gender ?? profile.gender ?? undefined,
    height_cm: stored.height_cm ?? profile.height_cm ?? undefined,
    intake_weight_kg:
      stored.intake_weight_kg ?? profile.intake_weight_kg ?? undefined,
    goal: stored.goal ?? profile.goal ?? undefined,
  };
}

function hasResponseValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function getMissingIntakeResponses(responses: IntakeResponses): string[] {
  return REQUIRED_RESPONSE_KEYS.filter(({ key }) => !hasResponseValue(responses[key])).map(
    ({ label }) => label
  );
}

export function isIntakeResponsesComplete(responses: IntakeResponses): boolean {
  return getMissingIntakeResponses(responses).length === 0;
}

export function getRequiredIntakeFieldCount(): number {
  return REQUIRED_RESPONSE_KEYS.length;
}

export function isClientIntakeCompleteFromProfile(profile: Profile): boolean {
  const responses = profileToResponses(profile);
  if (isIntakeResponsesComplete(responses)) return true;
  return false;
}

export type ClientIntakeStatus = "complete" | "partial" | "empty";

export function getClientIntakeStatusFromProfile(profile: Profile): ClientIntakeStatus {
  const responses = profileToResponses(profile);
  const missing = getMissingIntakeResponses(responses);
  if (missing.length === 0) return "complete";
  const filled = REQUIRED_RESPONSE_KEYS.length - missing.length;
  return filled > 0 ? "partial" : "empty";
}

export function getStepMissingFields(
  stepId: string,
  responses: IntakeResponses
): string[] {
  switch (stepId) {
    case "basics":
      return ["age", "gender", "height_cm", "intake_weight_kg"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "goal":
      return ["goal", "goal_timeline"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "training":
      return ["training_experience", "training_days_per_week", "training_time_preference"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "work":
      return ["job_type", "work_hours", "daily_steps"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "sleep":
      return ["sleep_hours", "energy_level"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "nutrition":
      return ["diet_type", "meals_per_day", "cooking_frequency"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    case "health":
      return [];
    case "lifestyle":
      return ["smoking", "alcohol", "stress_level", "water_habits"].filter(
        (k) => !hasResponseValue(responses[k as keyof IntakeResponses])
      );
    default:
      return [];
  }
}

export function buildDetailedIntakeContextForAi(responses: IntakeResponses): string {
  const lines: string[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  add("Age", responses.age ? `${responses.age} years` : null);
  add(
    "Gender",
    GENDER_OPTIONS.find((o) => o.value === responses.gender)?.label ?? responses.gender
  );
  add("Weight", responses.intake_weight_kg ? `${responses.intake_weight_kg} kg` : null);
  add("Height", responses.height_cm ? `${responses.height_cm} cm` : null);
  add("Goal", GOAL_LABELS[responses.goal ?? ""] ?? responses.goal);
  add("Timeline", labelFor(GOAL_TIMELINE_OPTIONS, responses.goal_timeline));
  add("Training experience", labelFor(TRAINING_EXPERIENCE_OPTIONS, responses.training_experience));
  add("Training days/week", labelFor(TRAINING_DAYS_OPTIONS, responses.training_days_per_week));
  add("Workout time", labelFor(TRAINING_TIME_OPTIONS, responses.training_time_preference));
  add("Equipment", labelsFor(EQUIPMENT_OPTIONS, responses.equipment_access));
  add("Activities", labelsFor(ACTIVITY_OPTIONS, responses.current_activities));
  add("Job type", labelFor(JOB_TYPE_OPTIONS, responses.job_type));
  add("Work hours", labelFor(WORK_HOURS_OPTIONS, responses.work_hours));
  add("Commute", labelFor(COMMUTE_OPTIONS, responses.commute));
  add("Daily steps", labelFor(DAILY_STEPS_OPTIONS, responses.daily_steps));
  add("Sleep", labelFor(SLEEP_HOURS_OPTIONS, responses.sleep_hours));
  add("Wake time", responses.wake_time);
  add("Bedtime", responses.bedtime);
  add("Energy", labelFor(ENERGY_OPTIONS, responses.energy_level));
  add("Diet", labelFor(DIET_TYPE_OPTIONS, responses.diet_type));
  add("Meals/day", labelFor(MEALS_PER_DAY_OPTIONS, responses.meals_per_day));
  add("Cooking", labelFor(COOKING_OPTIONS, responses.cooking_frequency));
  add("Allergies", labelsFor(ALLERGY_OPTIONS, responses.food_allergies));
  add("Food dislikes", responses.food_dislikes);
  add("Injuries", buildInjuriesText(responses));
  add("Health conditions", buildMedicalConditionsText(responses));
  add("Medications", responses.medications);
  add("Smoking", labelFor(SMOKING_OPTIONS, responses.smoking));
  add("Alcohol", labelFor(ALCOHOL_OPTIONS, responses.alcohol));
  add("Stress", labelFor(STRESS_OPTIONS, responses.stress_level));
  add("Water habits", labelFor(WATER_HABITS_OPTIONS, responses.water_habits));

  return lines.join("\n");
}

export function buildIntakeSummaryFromResponses(
  responses: IntakeResponses
): { label: string; value: string }[] {
  const push = (label: string, value: string | null | undefined) => {
    if (!value) return [];
    return [{ label, value }];
  };

  return [
    ...push("Age", responses.age ? `${responses.age} years` : null),
    ...push(
      "Gender",
      GENDER_OPTIONS.find((o) => o.value === responses.gender)?.label ?? responses.gender
    ),
    ...push("Weight", responses.intake_weight_kg ? `${responses.intake_weight_kg} kg` : null),
    ...push("Height", responses.height_cm ? `${responses.height_cm} cm` : null),
    ...push("Goal", GOAL_LABELS[responses.goal ?? ""] ?? responses.goal),
    ...push("Timeline", labelFor(GOAL_TIMELINE_OPTIONS, responses.goal_timeline)),
    ...push("Training", labelFor(TRAINING_EXPERIENCE_OPTIONS, responses.training_experience)),
    ...push("Work", labelFor(JOB_TYPE_OPTIONS, responses.job_type)),
    ...push("Sleep", labelFor(SLEEP_HOURS_OPTIONS, responses.sleep_hours)),
    ...push("Diet", labelFor(DIET_TYPE_OPTIONS, responses.diet_type)),
    ...push("Injuries", buildInjuriesText(responses) || null),
    ...push("Health", buildMedicalConditionsText(responses) || null),
  ];
}

export const EMPTY_INTAKE_RESPONSES: IntakeResponses = {};
