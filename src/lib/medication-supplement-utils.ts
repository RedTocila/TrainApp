export type MedicationSupplementAnalysis = {
  performanceSupplements: string[];
  benignSupplements: string[];
  concerningMedications: string[];
  unknownEntries: string[];
};

const PERFORMANCE_PATTERNS: RegExp[] = [
  /\bcreatine\b/i,
  /\bprotein\b/i,
  /\bwhey\b/i,
  /\bcasein\b/i,
  /\bbcaa\b/i,
  /\bbeta[\s-]?alanine\b/i,
  /\bpre[\s-]?workout\b/i,
  /\bcitrulline\b/i,
  /\bcaffeine\b/i,
  /\beaa\b/i,
  /\bglutamine\b/i,
  /\bhmb\b/i,
  /\bcarb\s*powder\b/i,
];

const BENIGN_PATTERNS: RegExp[] = [
  /\bvitamin\b/i,
  /\bmultivitamin\b/i,
  /\bomega[\s-]?3\b/i,
  /\bfish oil\b/i,
  /\bmagnesium\b/i,
  /\bzinc\b/i,
  /\bvitamin d\b/i,
  /\bd3\b/i,
  /\bcollagen\b/i,
  /\bprobiotic\b/i,
  /\biron\b/i,
  /\bcalcium\b/i,
  /\bmultimineral\b/i,
  /\b electrolyte/i,
  /\belectrolytes\b/i,
];

const CONCERNING_PATTERNS: RegExp[] = [
  /\bbeta[\s-]?blocker/i,
  /\bblood pressure\b/i,
  /\bhypertension\b/i,
  /\bstatins?\b/i,
  /\batorvastatin\b/i,
  /\binsulin\b/i,
  /\bmetformin\b/i,
  /\bantidepress/i,
  /\b ssri\b/i,
  /\bsnri\b/i,
  /\bblood thinner\b/i,
  /\bwarfarin\b/i,
  /\beliquis\b/i,
  /\bsteroid\b/i,
  /\bprednisone\b/i,
  /\bcortisol\b/i,
  /\bchemo\b/i,
  /\bdiuretic\b/i,
  /\bopioid\b/i,
  /\bpainkiller\b/i,
  /\btramadol\b/i,
  /\bcodeine\b/i,
  /\bsleeping pill\b/i,
  /\bambien\b/i,
  /\bthyroid\b/i,
  /\blevothyroxine\b/i,
  /\bepilep/i,
  /\banticoag/i,
];

function splitMedicationEntries(text: string): string[] {
  return text
    .split(/[,;\n+/&|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function analyzeMedicationsSupplements(text: string | undefined | null): MedicationSupplementAnalysis {
  const result: MedicationSupplementAnalysis = {
    performanceSupplements: [],
    benignSupplements: [],
    concerningMedications: [],
    unknownEntries: [],
  };

  const raw = text?.trim();
  if (!raw) return result;

  for (const entry of splitMedicationEntries(raw)) {
    if (matchesAny(entry, CONCERNING_PATTERNS)) {
      result.concerningMedications.push(entry);
    } else if (matchesAny(entry, PERFORMANCE_PATTERNS)) {
      result.performanceSupplements.push(entry);
    } else if (matchesAny(entry, BENIGN_PATTERNS)) {
      result.benignSupplements.push(entry);
    } else {
      result.unknownEntries.push(entry);
    }
  }

  return result;
}

export function hasMeaningfulMedicationConcern(analysis: MedicationSupplementAnalysis): boolean {
  return analysis.concerningMedications.length > 0 || analysis.unknownEntries.length > 0;
}
