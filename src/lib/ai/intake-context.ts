import type { Profile } from "@/lib/types";
import { formatGender, formatGoal } from "@/lib/intake-display";
import {
  buildDetailedIntakeContextForAi,
  buildIntakeSummaryFromResponses,
  profileToResponses,
} from "@/lib/intake-questionnaire";

export function buildIntakeContextForAi(profile: Profile, extraNotes?: string): string {
  const responses = profileToResponses(profile);
  if (responses.goal) {
    const detailed = buildDetailedIntakeContextForAi(responses);
    if (detailed) {
      const lines = detailed.split("\n");
      if (extraNotes?.trim()) lines.push(`Client notes: ${extraNotes.trim()}`);
      return lines.join("\n");
    }
  }

  const structured = buildIntakeSummaryFromResponses(profileToResponses(profile));
  if (structured.length > 0) {
    const lines = structured.map((item) => `${item.label}: ${item.value}`);
    if (extraNotes?.trim()) lines.push(`Client notes: ${extraNotes.trim()}`);
    return lines.join("\n");
  }

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
