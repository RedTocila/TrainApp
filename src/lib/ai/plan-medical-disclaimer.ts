import { resolveAiLanguagePreference } from "@/lib/ai/language-instructions";

const DISCLAIMER_EN =
  "Not medical advice — I'm not a doctor. This is a general fitness/nutrition suggestion based on your profile. Confirm with a qualified professional before changing training, diet, or meds, especially with injuries or health conditions.";

const DISCLAIMER_AL =
  "Nuk është këshillë mjekësore — unë nuk jam mjek. Kjo është vetëm një sugjerim i përgjithshëm stërvitjeje/ushqimi sipas profilit tënd. Konsultohu me një profesionist të kualifikuar para se të ndryshosh stërvitjen, dietën ose medikamentet, sidomos nëse ke dëmtime ose gjendje shëndetësore.";

export function planMedicalDisclaimer(locale?: string | null): string {
  return resolveAiLanguagePreference(locale) === "al" ? DISCLAIMER_AL : DISCLAIMER_EN;
}

/** Ensure coach_notes ends with the medical disclaimer (deduped). */
export function withPlanMedicalDisclaimer(
  notes: string[] | undefined,
  locale?: string | null
): string[] {
  const disclaimer = planMedicalDisclaimer(locale);
  const cleaned = (notes ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n) => !isDisclaimerLike(n));
  return [...cleaned, disclaimer];
}

function isDisclaimerLike(note: string): boolean {
  const lower = note.toLowerCase();
  return (
    lower.includes("not a doctor") ||
    lower.includes("not medical advice") ||
    lower.includes("nuk jam mjek") ||
    lower.includes("nuk është këshillë mjekësore")
  );
}
