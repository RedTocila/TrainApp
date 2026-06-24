import type { Profile } from "@/lib/types";
import { formatGender, formatGoal } from "@/lib/intake-display";

export function buildIntakeContextForAi(profile: Profile, extraNotes?: string): string {
  const lines: string[] = [];

  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`${label}: ${value}`);
  };

  add("Age", profile.age ? `${profile.age} years` : null);
  add("Gender", formatGender(profile.gender));
  add("Weight", profile.intake_weight_kg ? `${profile.intake_weight_kg} kg` : null);
  add("Height", profile.height_cm ? `${profile.height_cm} cm` : null);
  add("Goal", formatGoal(profile.goal));
  add("Daily routine", profile.daily_routine);
  add("Work schedule", profile.work_schedule);
  add("Injuries / limitations", profile.injuries);
  add("Medical conditions", profile.medical_conditions);
  add("Vices", profile.vices);
  add("Current calorie target", profile.target_calories);
  add("Current protein target (g)", profile.target_protein);

  if (extraNotes?.trim()) {
    lines.push(`Client notes: ${extraNotes.trim()}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No health profile filled in yet.";
}
