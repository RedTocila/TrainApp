import type { Profile } from "@/lib/types";
import {
  buildIntakeSummaryFromResponses,
  profileToResponses,
} from "@/lib/intake-questionnaire";

export const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
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

export interface IntakeSummaryItem {
  label: string;
  value: string;
}

export function buildIntakeSummary(profile: Profile): IntakeSummaryItem[] {
  const fromQuestionnaire = buildIntakeSummaryFromResponses(
    profileToResponses(profile)
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
  push("Weight", profile.intake_weight_kg ? `${profile.intake_weight_kg} kg` : null);
  push("Height", profile.height_cm ? `${profile.height_cm} cm` : null);
  push("Goal", formatGoal(profile.goal));
  push("Daily routine", profile.daily_routine);
  push("Work schedule", profile.work_schedule);
  push("Injuries", profile.injuries);
  push("Medical conditions", profile.medical_conditions);
  push("Vices", profile.vices);

  return items;
}
