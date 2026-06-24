import type { BodyWeightLog } from "@/lib/types";

export type BmiCategory = "underweight" | "healthy" | "overweight" | "obese";

export const BMI_CATEGORIES: {
  key: BmiCategory;
  label: string;
  range: string;
  color: string;
}[] = [
  { key: "underweight", label: "Underweight", range: "< 18.5", color: "bg-sky-500" },
  { key: "healthy", label: "Healthy", range: "18.5 – 24.9", color: "bg-emerald-500" },
  { key: "overweight", label: "Overweight", range: "25.0 – 29.9", color: "bg-amber-400" },
  { key: "obese", label: "Obese", range: "> 30.0", color: "bg-red-500" },
];

const CATEGORY_STYLES: Record<
  BmiCategory,
  { pill: string; text: string }
> = {
  underweight: {
    pill: "bg-sky-500/15 text-sky-400",
    text: "text-sky-400",
  },
  healthy: {
    pill: "bg-emerald-500/15 text-emerald-400",
    text: "text-emerald-400",
  },
  overweight: {
    pill: "bg-amber-400/15 text-amber-400",
    text: "text-amber-400",
  },
  obese: {
    pill: "bg-red-500/15 text-red-400",
    text: "text-red-400",
  },
};

export function resolveLatestWeightKg(
  history: BodyWeightLog[],
  intakeWeightKg?: number | null
): number | null {
  if (history.length > 0) {
    return history[history.length - 1]!.weight_kg;
  }
  if (intakeWeightKg != null && Number.isFinite(intakeWeightKg)) {
    return intakeWeightKg;
  }
  return null;
}

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function getBmiCategoryStyle(category: BmiCategory) {
  return CATEGORY_STYLES[category];
}

/** Map BMI to 0–100% position on the equal-segment gauge. */
export function bmiToGaugePercent(bmi: number): number {
  if (bmi < 18.5) {
    const min = 15;
    const clamped = Math.max(min, bmi);
    return ((clamped - min) / (18.5 - min)) * 25;
  }
  if (bmi < 25) {
    return 25 + ((bmi - 18.5) / (24.9 - 18.5)) * 25;
  }
  if (bmi < 30) {
    return 50 + ((bmi - 25) / (29.9 - 25)) * 25;
  }
  const max = 40;
  const clamped = Math.min(bmi, max);
  return 75 + ((clamped - 30) / (max - 30)) * 25;
}
