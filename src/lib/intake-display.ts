import type { Profile } from "@/lib/types";
import {
  formatHeightWithUnitFromCm,
  formatWeightWithUnitFromKg,
  type UnitSystem,
} from "@/lib/body-units";
import {
  buildIntakeSummaryFromResponses,
  profileToResponses,
} from "@/lib/intake-questionnaire";

export const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  stay_fit: "Stay fit",
  improve_endurance: "Improve endurance",
  general_health: "General health",
};

export function formatGender(value: string | null | undefined): string | null {
  if (!value) return null;
  return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function formatGoal(value: string | null | undefined): string | null {
  if (!value) return null;
  return GOAL_LABELS[value] ?? value;
}

export function resolveProfileGoal(
  profile: Pick<Profile, "goal" | "intake_responses">
): string | null {
  if (profile.goal) return profile.goal;
  const fromIntake = profile.intake_responses?.goal;
  return typeof fromIntake === "string" && fromIntake.length > 0 ? fromIntake : null;
}

export interface IntakeSummaryItem {
  label: string;
  value: string;
}

export function buildIntakeSummary(
  profile: Profile,
  unitSystem: UnitSystem = profile.unit_system ?? "metric"
): IntakeSummaryItem[] {
  const fromQuestionnaire = buildIntakeSummaryFromResponses(
    profileToResponses(profile),
    unitSystem
  );
  if (fromQuestionnaire.length > 0) {
    return fromQuestionnaire;
  }

  const items: IntakeSummaryItem[] = [];

  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    items.push({ label, value: String(value) });
  };

  push("Age", profile.age ? `${profile.age} years` : null);
  push("Gender", formatGender(profile.gender));
  push("Weight", profile.intake_weight_kg
    ? formatWeightWithUnitFromKg(profile.intake_weight_kg, unitSystem)
    : null);
  push("Height", profile.height_cm
    ? formatHeightWithUnitFromCm(profile.height_cm, unitSystem)
    : null);
  push("Goal", formatGoal(profile.goal));
  push("Daily routine", profile.daily_routine);
  push("Work schedule", profile.work_schedule);
  push("Injuries", profile.injuries);
  push("Medical conditions", profile.medical_conditions);
  push("Vices", profile.vices);

  return items;
}
