import type { OverageTipCopy } from "@/lib/macro-overage-local";
import type { PlatformCopy } from "@/lib/platform-copy";

/** Local overage copy (tips + localized explanation) for instant UI / AI fallback. */
export function buildOverageLocalCopy(
  nutrition: PlatformCopy["nutrition"]
): OverageTipCopy {
  return {
    ...nutrition.overageTips,
    noMealsName: nutrition.overageNoMealsName,
    nutrientShort: nutrition.nutrientShort,
    explain: nutrition.overageExplanation,
  };
}
