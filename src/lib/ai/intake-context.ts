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

export function getCriticalIntakeGaps(profile: Profile): string[] {
  const responses = profileToResponses(profile);
  const gaps: string[] = [];

  const hasInjuries = hasMeaningfulMulti(responses.injury_areas);
  const hasConditions = hasMeaningfulMulti(responses.health_conditions);
  const hasPcos = responses.health_conditions?.includes("pcos") ?? false;
  const hasOtherCondition = responses.health_conditions?.includes("other") ?? false;

  if (hasInjuries && !hasText(responses.injury_details)) {
    gaps.push("Please describe injury limits (pain triggers, movement restrictions, and what to avoid).");
  }

  if (hasConditions && !hasText(responses.health_condition_details)) {
    gaps.push("Please add condition details (current status, symptoms, and coach-relevant limits).");
  }

  if (hasOtherCondition && !hasText(responses.health_condition_details)) {
    gaps.push("You selected 'Other' health condition — please name it and add key details.");
  }

  if (hasPcos && !hasText(responses.health_condition_details)) {
    gaps.push("Please add PCOS context (doctor guidance or known symptom triggers relevant to training/nutrition).");
  }

  if (hasConditions && !hasText(responses.medications)) {
    gaps.push("Please list current medications or supplements, or explicitly write 'none'.");
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

  const criticalGaps = getCriticalIntakeGaps(profile);
  lines.push(
    "",
    "CRITICAL INFO GAPS (ASK BEFORE FINAL PLAN IF ANY):",
    ...(criticalGaps.length > 0
      ? criticalGaps.map((gap, idx) => `${idx + 1}. ${gap}`)
      : ["None. Safety-critical profile details look sufficient."])
  );

  if (extraNotes?.trim()) {
    lines.push("", `Client notes: ${extraNotes.trim()}`);
  }

  return lines.join("\n");
}
