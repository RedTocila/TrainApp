import type { Profile } from "@/lib/types";
import { formatGender, formatGoal } from "@/lib/intake-display";
import {
  buildDetailedIntakeContextForAi,
  buildMedicalConditionsText,
  buildInjuriesText,
  buildNutritionNotes,
  buildIntakeSummaryFromResponses,
  profileToResponses,
} from "@/lib/intake-questionnaire";

function hasMeaningfulMulti(values?: string[]): boolean {
  if (!values?.length) return false;
  return values.some((v) => v !== "none");
}

function hasText(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

/**
 * Soft profile gaps for the AI prompt only — never block plan generation.
 * Named conditions (e.g. PCOS), injuries, and meds should still produce a plan
 * with conservative adaptations + a medical disclaimer.
 */
export function getCriticalIntakeGaps(profile: Profile): string[] {
  const responses = profileToResponses(profile);
  const gaps: string[] = [];

  const hasInjuries = hasMeaningfulMulti(responses.injury_areas);
  const hasConditions = hasMeaningfulMulti(responses.health_conditions);
  const hasPcos = responses.health_conditions?.includes("pcos") ?? false;
  const hasOtherCondition = responses.health_conditions?.includes("other") ?? false;

  if (hasInjuries && !hasText(responses.injury_details)) {
    gaps.push(
      "Injury areas are flagged without details — use conservative, low-irritation alternatives and note modifications."
    );
  }

  if (hasConditions && !hasText(responses.health_condition_details)) {
    gaps.push(
      "Health conditions are named without extra notes — apply condition-aware, conservative defaults from the named conditions."
    );
  }

  if (hasOtherCondition && !hasText(responses.health_condition_details)) {
    gaps.push(
      "'Other' health condition has no description — stay general and conservative; do not invent a diagnosis."
    );
  }

  if (hasPcos && !hasText(responses.health_condition_details)) {
    gaps.push(
      "PCOS is flagged without extra notes — prefer insulin-friendly nutrition and sustainable training volume; avoid medical treatment claims."
    );
  }

  if (hasConditions && !hasText(responses.medications)) {
    gaps.push(
      "Medications/supplements were not listed — do not assume prescriptions; keep advice general."
    );
  }

  return gaps;
}

export function buildIntakeContextForAi(profile: Profile, extraNotes?: string): string {
  const responses = profileToResponses(profile);
  const detailed = buildDetailedIntakeContextForAi(responses);
  const structured = buildIntakeSummaryFromResponses(responses);
  const conditions = buildMedicalConditionsText(responses) || profile.medical_conditions || "";
  const injuries = buildInjuriesText(responses) || profile.injuries || "";
  const nutritionSafety = buildNutritionNotes(responses);

  const safetyFlags: string[] = [];
  if (conditions) safetyFlags.push(`Health conditions and meds: ${conditions}`);
  if (injuries) safetyFlags.push(`Injuries and movement limits: ${injuries}`);
  if (nutritionSafety) safetyFlags.push(`Nutrition constraints: ${nutritionSafety}`);
  if (responses.medications?.trim()) {
    safetyFlags.push(`Medications / supplements: ${responses.medications.trim()}`);
  }

  const profileLines: string[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    profileLines.push(`${label}: ${value}`);
  };

  add("Age", profile.age ? `${profile.age} years` : null);
  add("Gender", formatGender(profile.gender));
  add("Baseline weight", profile.intake_weight_kg ? `${profile.intake_weight_kg} kg` : null);
  add("Height", profile.height_cm ? `${profile.height_cm} cm` : null);
  add("Primary goal", formatGoal(profile.goal));
  add("Daily routine", profile.daily_routine);
  add("Work schedule", profile.work_schedule);
  add("Lifestyle factors", profile.vices);
  add("Current calories target", profile.target_calories);
  add("Current protein target (g)", profile.target_protein);
  add("Current carbs target (g)", profile.target_carbs);
  add("Current fat target (g)", profile.target_fat);

  const lines: string[] = [
    "PROFILE SAFETY FLAGS (MUST APPLY TO EVERY RECOMMENDATION):",
    ...(safetyFlags.length > 0
      ? safetyFlags.map((flag, idx) => `${idx + 1}. ${flag}`)
      : ["1. No explicit medical, injury, medication, or nutrition risk flags were provided."]),
    "",
    "PROFILE SNAPSHOT:",
    ...(profileLines.length > 0 ? profileLines : ["No profile basics yet."]),
    "",
    "QUESTIONNAIRE DETAILS:",
    ...(detailed ? detailed.split("\n") : structured.map((item) => `${item.label}: ${item.value}`)),
  ];

  const softGaps = getCriticalIntakeGaps(profile);
  lines.push(
    "",
    "SAFETY / DETAIL NOTES (do NOT refuse or delay the plan — adapt conservatively and still return full JSON):",
    ...(softGaps.length > 0
      ? softGaps.map((gap, idx) => `${idx + 1}. ${gap}`)
      : ["None. Safety-critical profile details look sufficient."]),
    "",
    "MEDICAL BOUNDARY (mandatory in coach_notes):",
    "You are not a doctor. End coach_notes with a clear disclaimer that this is a general suggestion, not medical advice, and the client should confirm with a qualified professional — especially with injuries, medications, or health conditions."
  );

  if (extraNotes?.trim()) {
    lines.push("", `Client notes: ${extraNotes.trim()}`);
  }

  return lines.join("\n");
}
