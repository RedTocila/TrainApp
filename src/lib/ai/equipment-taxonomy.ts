/**
 * Equipment taxonomy + constraint resolution for AI workout generation.
 *
 * Catalog equipment tags (ExerciseDB) are the source of truth. Intake values
 * and free-text user requests are mapped onto allowlists of those tags.
 * Unrestricted mode (full gym) skips filtering.
 */

import type { CatalogExercise } from "@/lib/exercise-catalog";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import { profileToResponses } from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

/** Canonical catalog equipment tags used in allowlists. */
export const CATALOG_EQUIPMENT = {
  BODY_WEIGHT: "body weight",
  DUMBBELL: "dumbbell",
  BARBELL: "barbell",
  EZ_BARBELL: "ez barbell",
  OLYMPIC_BARBELL: "olympic barbell",
  TRAP_BAR: "trap bar",
  KETTLEBELL: "kettlebell",
  CABLE: "cable",
  LEVERAGE_MACHINE: "leverage machine",
  SMITH_MACHINE: "smith machine",
  SLED_MACHINE: "sled machine",
  ASSISTED: "assisted",
  BAND: "band",
  RESISTANCE_BAND: "resistance band",
  MEDICINE_BALL: "medicine ball",
  STABILITY_BALL: "stability ball",
  BOSU_BALL: "bosu ball",
  WEIGHTED: "weighted",
  ROPE: "rope",
  ROLLER: "roller",
  WHEEL_ROLLER: "wheel roller",
  HAMMER: "hammer",
  TIRE: "tire",
  ELLIPTICAL: "elliptical machine",
  STATIONARY_BIKE: "stationary bike",
  STEPMILL: "stepmill machine",
  SKIERG: "skierg machine",
  UPPER_BODY_ERGOMETER: "upper body ergometer",
} as const;

export type CatalogEquipmentTag =
  (typeof CATALOG_EQUIPMENT)[keyof typeof CATALOG_EQUIPMENT];

/** Synonyms → canonical catalog tag. */
const TAG_ALIASES: Record<string, string> = {
  "body weight": CATALOG_EQUIPMENT.BODY_WEIGHT,
  bodyweight: CATALOG_EQUIPMENT.BODY_WEIGHT,
  "body-weight": CATALOG_EQUIPMENT.BODY_WEIGHT,
  none: CATALOG_EQUIPMENT.BODY_WEIGHT,
  band: CATALOG_EQUIPMENT.BAND,
  bands: CATALOG_EQUIPMENT.BAND,
  "resistance band": CATALOG_EQUIPMENT.RESISTANCE_BAND,
  "resistance bands": CATALOG_EQUIPMENT.RESISTANCE_BAND,
  dumbbell: CATALOG_EQUIPMENT.DUMBBELL,
  dumbbells: CATALOG_EQUIPMENT.DUMBBELL,
  db: CATALOG_EQUIPMENT.DUMBBELL,
  barbell: CATALOG_EQUIPMENT.BARBELL,
  barbells: CATALOG_EQUIPMENT.BARBELL,
  "ez barbell": CATALOG_EQUIPMENT.EZ_BARBELL,
  "olympic barbell": CATALOG_EQUIPMENT.OLYMPIC_BARBELL,
  "trap bar": CATALOG_EQUIPMENT.TRAP_BAR,
  kettlebell: CATALOG_EQUIPMENT.KETTLEBELL,
  kettlebells: CATALOG_EQUIPMENT.KETTLEBELL,
  cable: CATALOG_EQUIPMENT.CABLE,
  cables: CATALOG_EQUIPMENT.CABLE,
  machine: CATALOG_EQUIPMENT.LEVERAGE_MACHINE,
  machines: CATALOG_EQUIPMENT.LEVERAGE_MACHINE,
  "leverage machine": CATALOG_EQUIPMENT.LEVERAGE_MACHINE,
  "smith machine": CATALOG_EQUIPMENT.SMITH_MACHINE,
  smith: CATALOG_EQUIPMENT.SMITH_MACHINE,
  sled: CATALOG_EQUIPMENT.SLED_MACHINE,
  "sled machine": CATALOG_EQUIPMENT.SLED_MACHINE,
};

export function normalizeEquipmentTag(tag: string): string {
  const key = tag.trim().toLowerCase();
  return TAG_ALIASES[key] ?? key;
}

const BODYWEIGHT_ONLY = new Set<string>([CATALOG_EQUIPMENT.BODY_WEIGHT]);

const HOME_WEIGHTS = new Set<string>([
  CATALOG_EQUIPMENT.BODY_WEIGHT,
  CATALOG_EQUIPMENT.DUMBBELL,
  CATALOG_EQUIPMENT.KETTLEBELL,
  CATALOG_EQUIPMENT.BAND,
  CATALOG_EQUIPMENT.RESISTANCE_BAND,
  CATALOG_EQUIPMENT.MEDICINE_BALL,
  CATALOG_EQUIPMENT.STABILITY_BALL,
  CATALOG_EQUIPMENT.BOSU_BALL,
  CATALOG_EQUIPMENT.WEIGHTED,
  CATALOG_EQUIPMENT.ROPE,
  CATALOG_EQUIPMENT.ROLLER,
  CATALOG_EQUIPMENT.WHEEL_ROLLER,
]);

const BANDS_ONLY = new Set<string>([
  CATALOG_EQUIPMENT.BODY_WEIGHT,
  CATALOG_EQUIPMENT.BAND,
  CATALOG_EQUIPMENT.RESISTANCE_BAND,
]);

const DUMBBELLS_ONLY = new Set<string>([
  CATALOG_EQUIPMENT.BODY_WEIGHT,
  CATALOG_EQUIPMENT.DUMBBELL,
]);

const OUTDOOR = new Set<string>([
  CATALOG_EQUIPMENT.BODY_WEIGHT,
  CATALOG_EQUIPMENT.MEDICINE_BALL,
  CATALOG_EQUIPMENT.TIRE,
  CATALOG_EQUIPMENT.ROPE,
  CATALOG_EQUIPMENT.BAND,
  CATALOG_EQUIPMENT.RESISTANCE_BAND,
  CATALOG_EQUIPMENT.KETTLEBELL,
]);

const GYM_MACHINES = new Set<string>([
  CATALOG_EQUIPMENT.LEVERAGE_MACHINE,
  CATALOG_EQUIPMENT.SMITH_MACHINE,
  CATALOG_EQUIPMENT.SLED_MACHINE,
  CATALOG_EQUIPMENT.ASSISTED,
  CATALOG_EQUIPMENT.CABLE,
  CATALOG_EQUIPMENT.ELLIPTICAL,
  CATALOG_EQUIPMENT.STATIONARY_BIKE,
  CATALOG_EQUIPMENT.STEPMILL,
  CATALOG_EQUIPMENT.SKIERG,
  CATALOG_EQUIPMENT.UPPER_BODY_ERGOMETER,
]);

export type EquipmentConstraintSource = "intake" | "request" | "merged" | "default";

export type EquipmentConstraint = {
  /** null allowedTags = unrestricted (full gym / no filter). */
  allowedTags: ReadonlySet<string> | null;
  promptRule: string;
  source: EquipmentConstraintSource;
  /** Short label for logs / debugging. */
  label: string;
};

export function isUnrestricted(constraint: EquipmentConstraint): boolean {
  return constraint.allowedTags === null;
}

export function isBodyweightOnlyConstraint(
  constraint: EquipmentConstraint
): boolean {
  if (!constraint.allowedTags) return false;
  if (constraint.allowedTags.size !== 1) return false;
  return constraint.allowedTags.has(CATALOG_EQUIPMENT.BODY_WEIGHT);
}

/** Tags an exercise effectively requires (empty → body weight). */
export function exerciseEquipmentTags(exercise: CatalogExercise): string[] {
  if (!exercise.equipment.length) return [CATALOG_EQUIPMENT.BODY_WEIGHT];
  return exercise.equipment.map(normalizeEquipmentTag);
}

/**
 * Every required equipment tag must be in the allowlist.
 * Unrestricted constraints always pass.
 */
export function exerciseAllowedByConstraint(
  exercise: CatalogExercise,
  constraint: EquipmentConstraint
): boolean {
  if (!constraint.allowedTags) return true;
  return exerciseEquipmentTags(exercise).every((tag) =>
    constraint.allowedTags!.has(tag)
  );
}

export function filterCatalogByEquipment(
  exercises: CatalogExercise[],
  constraint: EquipmentConstraint
): CatalogExercise[] {
  if (!constraint.allowedTags) return exercises;
  return exercises.filter((ex) => exerciseAllowedByConstraint(ex, constraint));
}

function constraintFromTags(
  tags: ReadonlySet<string> | null,
  promptRule: string,
  label: string,
  source: EquipmentConstraintSource
): EquipmentConstraint {
  return { allowedTags: tags, promptRule, label, source };
}

/** Map intake questionnaire equipment_access → constraint. */
export function equipmentConstraintFromIntakeAccess(
  equipmentAccess: string[] | undefined,
  source: EquipmentConstraintSource = "intake"
): EquipmentConstraint {
  const equipment = equipmentAccess ?? [];
  const has = (v: string) => equipment.includes(v);

  if (has("full_gym")) {
    return constraintFromTags(
      null,
      "Client has full gym access — barbells, machines, cables, and free weights are allowed.",
      "full_gym",
      source
    );
  }
  if (has("home_dumbbells")) {
    return constraintFromTags(
      HOME_WEIGHTS,
      "HARD CONSTRAINT: Home weights only. Allowed catalog equipment: body weight, dumbbell, kettlebell, band/resistance band, medicine/stability ball. NO barbells, cables, smith, sled, or leverage machines.",
      "home_dumbbells",
      source
    );
  }
  if (has("outdoor")) {
    return constraintFromTags(
      OUTDOOR,
      "HARD CONSTRAINT: Outdoor / park setting. Use bodyweight and simple outdoor-friendly moves only. NO gym machines, barbells, cables, or smith machines.",
      "outdoor",
      source
    );
  }
  if (
    has("bodyweight") ||
    has("none") ||
    has("no_equipment") ||
    equipment.length === 0
  ) {
    // Only treat as bodyweight-only when no other gear was selected.
    const hasGear = equipment.some(
      (v) =>
        v !== "bodyweight" &&
        v !== "none" &&
        v !== "no_equipment"
    );
    if (!hasGear) {
      return constraintFromTags(
        BODYWEIGHT_ONLY,
        "HARD CONSTRAINT: Bodyweight / no-equipment only. Every exercise MUST use catalog equipment \"body weight\" (or empty). NO dumbbells, barbells, cables, machines, bands, benches-as-equipment, or kettlebells.",
        "bodyweight",
        source
      );
    }
  }

  // Granular iOS equipment picks → union of allowed catalog tags.
  const granularTags = new Set<string>([CATALOG_EQUIPMENT.BODY_WEIGHT]);
  let matchedGranular = false;
  for (const item of equipment) {
    switch (item) {
      case "dumbbells":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.DUMBBELL);
        break;
      case "kettlebell":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.KETTLEBELL);
        break;
      case "resistance_bands":
      case "bands":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.BAND);
        granularTags.add(CATALOG_EQUIPMENT.RESISTANCE_BAND);
        break;
      case "barbell":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.BARBELL);
        granularTags.add(CATALOG_EQUIPMENT.EZ_BARBELL);
        granularTags.add(CATALOG_EQUIPMENT.OLYMPIC_BARBELL);
        granularTags.add(CATALOG_EQUIPMENT.TRAP_BAR);
        break;
      case "cable":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.CABLE);
        break;
      case "machines":
        matchedGranular = true;
        for (const tag of GYM_MACHINES) granularTags.add(tag);
        break;
      case "bench":
      case "pull_up_bar":
        // Bench / pull-up bar don't expand catalog tags beyond bodyweight + listed free weights.
        matchedGranular = true;
        break;
      default:
        break;
    }
  }

  if (matchedGranular) {
    const labels = equipment.filter(
      (v) => v !== "bodyweight" && v !== "none" && v !== "no_equipment"
    );
    return constraintFromTags(
      granularTags,
      `HARD CONSTRAINT: Only use equipment the client listed (${labels.join(", ") || "bodyweight"}). Bodyweight is always allowed. Do NOT invent machines, barbells, cables, or free weights they did not select.`,
      "granular_intake",
      source
    );
  }

  // Unknown combo — be conservative: bodyweight + whatever we can map.
  return constraintFromTags(
    BODYWEIGHT_ONLY,
    "HARD CONSTRAINT: Only use equipment the client listed; when unsure stay bodyweight-only.",
    "unknown_intake",
    source
  );
}

/**
 * Detect explicit equipment intent in free-text preferences / chat.
 * Returns null when the text does not clearly override equipment.
 */
export function parseEquipmentConstraintFromText(
  text: string | undefined | null
): EquipmentConstraint | null {
  if (!text?.trim()) return null;
  const t = text.toLowerCase();

  // Order matters: more specific phrases first.
  if (
    /\b(no[\s-]?equipment|without\s+equipment|zero\s+equipment|equipment[\s-]?free|no\s+gear|nothing\s+but\s+body\s*weight|body\s*weight\s+only|bodyweight\s+only|only\s+body\s*weight|i\s+don'?t\s+have\s+(any\s+)?equipment)\b/.test(
      t
    )
  ) {
    return constraintFromTags(
      BODYWEIGHT_ONLY,
      "HARD CONSTRAINT (user request): No equipment / bodyweight only. Every exercise MUST be body weight. Do NOT use dumbbells, barbells, cables, machines, bands, or kettlebells.",
      "request_no_equipment",
      "request"
    );
  }

  if (
    /\b(dumbbells?\s+only|only\s+dumbbells?|just\s+dumbbells?|home\s+dumbbells?|db\s+only)\b/.test(
      t
    )
  ) {
    return constraintFromTags(
      DUMBBELLS_ONLY,
      "HARD CONSTRAINT (user request): Dumbbells only (bodyweight allowed as accessory). NO barbells, machines, cables, or kettlebells.",
      "request_dumbbells_only",
      "request"
    );
  }

  if (
    /\b((resistance\s+)?bands?\s+only|only\s+(use\s+)?(resistance\s+)?bands?|just\s+(resistance\s+)?bands?|use\s+only\s+(resistance\s+)?bands?)\b/.test(
      t
    )
  ) {
    return constraintFromTags(
      BANDS_ONLY,
      "HARD CONSTRAINT (user request): Resistance bands only (bodyweight allowed). NO dumbbells, barbells, machines, or cables.",
      "request_bands_only",
      "request"
    );
  }

  if (/\b(kettlebells?\s+only|only\s+kettlebells?)\b/.test(t)) {
    return constraintFromTags(
      new Set([CATALOG_EQUIPMENT.BODY_WEIGHT, CATALOG_EQUIPMENT.KETTLEBELL]),
      "HARD CONSTRAINT (user request): Kettlebells only (bodyweight allowed). NO barbells, dumbbells, machines, or cables.",
      "request_kettlebells_only",
      "request"
    );
  }

  if (/\b(no\s+machines?|without\s+machines?|avoid\s+machines?)\b/.test(t)) {
    // Start from home weights (no machines/cables) — still allows free weights.
    const noMachines = new Set(
      [...HOME_WEIGHTS, CATALOG_EQUIPMENT.BARBELL, CATALOG_EQUIPMENT.EZ_BARBELL]
    );
    for (const m of GYM_MACHINES) noMachines.delete(m);
    return constraintFromTags(
      noMachines,
      "HARD CONSTRAINT (user request): No machines or cables. Free weights and bodyweight only.",
      "request_no_machines",
      "request"
    );
  }

  if (/\b(full\s+gym|gym\s+equipment|at\s+the\s+gym)\b/.test(t)) {
    return constraintFromTags(
      null,
      "User requested full gym access — all catalog equipment is allowed.",
      "request_full_gym",
      "request"
    );
  }

  return null;
}

/**
 * Resolve the effective equipment constraint for a generation call.
 * Explicit request text overrides intake when present.
 */
export function resolveEquipmentConstraint(
  profile: Profile,
  preferences?: string | null
): EquipmentConstraint {
  const fromRequest = parseEquipmentConstraintFromText(preferences);
  if (fromRequest) return fromRequest;

  const responses: IntakeResponses = profileToResponses(profile);
  return equipmentConstraintFromIntakeAccess(
    responses.equipment_access,
    "intake"
  );
}

/** Prompt bullet listing allowed catalog names when constrained. */
export function buildEquipmentPromptRule(
  constraint: EquipmentConstraint,
  sampleNames: string[]
): string {
  const samples =
    sampleNames.length > 0
      ? `\n- Prefer these verified allowed library names: ${sampleNames
          .slice(0, 40)
          .map((n) => `"${n}"`)
          .join(", ")}.`
      : "";

  if (!constraint.allowedTags) {
    return `- Equipment: ${constraint.promptRule}${samples}`;
  }

  const tags = [...constraint.allowedTags].sort().join(", ");
  return `- ${constraint.promptRule}
- Allowed catalog equipment tags ONLY: ${tags}.
- Never invent exercises that need other equipment. If unsure, pick a body-weight library name.${samples}`;
}
