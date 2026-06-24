import type { Profile } from "@/lib/types";

const REQUIRED_INTAKE_FIELDS = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "intake_weight_kg", label: "Weight" },
  { key: "height_cm", label: "Height" },
  { key: "goal", label: "Goal" },
  { key: "daily_routine", label: "Daily routine" },
  { key: "work_schedule", label: "Work schedule" },
] as const;

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return false;
}

export function getMissingIntakeFields(profile: Profile): string[] {
  return REQUIRED_INTAKE_FIELDS.filter(({ key }) => !hasValue(profile[key])).map(
    ({ label }) => label
  );
}

export function isClientIntakeComplete(profile: Profile): boolean {
  return getMissingIntakeFields(profile).length === 0;
}
