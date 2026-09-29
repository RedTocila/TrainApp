/**
 * Equipment taxonomy + constraint resolution for AI workout generation.
 *
 * Catalog equipment tags (ExerciseDB) are the base vocabulary; exercise
 * profiles add hidden requirements the catalog misses (a "body weight" pull-up
 * still needs a bar, bench dips need a bench/chair, "monster walk" needs a band).
 *
 * A constraint = allowlist of catalog tags (null = any tag) + forbidden tags +
 * available props. Intake sets the baseline; explicit request text (and later
 * conversation turns) override it via composable directives — latest wins.
 */

import type { CatalogExercise } from "@/lib/exercise-catalog";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import { profileToResponses } from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";
import {
  ALL_EXERCISE_PROPS,
  PROP_LABELS,
  getExerciseProfile,
  propRequirementsSatisfied,
  type ExerciseProp,
} from "@/lib/ai/exercise-profile";
import {
  normalizeUserText,
  parseConstraintText,
  splitTargetList,
} from "@/lib/ai/constraint-language";

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

const BARBELL_TAGS = [
  CATALOG_EQUIPMENT.BARBELL,
  CATALOG_EQUIPMENT.EZ_BARBELL,
  CATALOG_EQUIPMENT.OLYMPIC_BARBELL,
  CATALOG_EQUIPMENT.TRAP_BAR,
];

const BAND_TAGS = [CATALOG_EQUIPMENT.BAND, CATALOG_EQUIPMENT.RESISTANCE_BAND];

/** "Weights" in casual speech = any external load. */
const WEIGHT_TAGS = [
  CATALOG_EQUIPMENT.DUMBBELL,
  CATALOG_EQUIPMENT.KETTLEBELL,
  ...BARBELL_TAGS,
  CATALOG_EQUIPMENT.WEIGHTED,
  CATALOG_EQUIPMENT.MEDICINE_BALL,
];

/** Tags only found in a commercial gym. */
const GYM_ONLY_TAGS = [...GYM_MACHINES, ...BARBELL_TAGS, CATALOG_EQUIPMENT.HAMMER, CATALOG_EQUIPMENT.TIRE];

/** Props assumed in a full gym (a partner is never assumed). */
const FULL_GYM_PROPS: ReadonlySet<ExerciseProp> = new Set(
  ALL_EXERCISE_PROPS.filter((p) => p !== "partner")
);
const OUTDOOR_PROPS: ReadonlySet<ExerciseProp> = new Set<ExerciseProp>([
  "wall",
  "pull_up_bar",
  "dip_station",
  "bench",
  "low_bar",
  "box_step",
]);
const NO_PROPS: ReadonlySet<ExerciseProp> = new Set<ExerciseProp>(["wall"]);

export type EquipmentConstraintSource = "intake" | "request" | "merged" | "default";

export type EquipmentConstraint = {
  /** null allowedTags = any catalog tag (full gym). */
  allowedTags: ReadonlySet<string> | null;
  promptRule: string;
  source: EquipmentConstraintSource;
  /** Short label for logs / debugging. */
  label: string;
  /** Non-catalog props available (bar, bench, chair…). Omitted = derived default. */
  allowedProps?: ReadonlySet<ExerciseProp>;
  /** Tags that are never allowed even when allowedTags is null ("no bands"). */
  forbiddenTags?: ReadonlySet<string>;
};

/** Props available under a constraint (explicit or derived from its tags). */
export function constraintProps(constraint: EquipmentConstraint): ReadonlySet<ExerciseProp> {
  if (constraint.allowedProps) return constraint.allowedProps;
  return constraint.allowedTags === null ? FULL_GYM_PROPS : NO_PROPS;
}

/** True when nothing is filtered (full gym, no forbidden tags, all gym props). */
export function isUnrestricted(constraint: EquipmentConstraint): boolean {
  if (constraint.allowedTags !== null) return false;
  if (constraint.forbiddenTags && constraint.forbiddenTags.size > 0) return false;
  const props = constraintProps(constraint);
  return [...FULL_GYM_PROPS].every((p) => props.has(p));
}

export function isBodyweightOnlyConstraint(
  constraint: EquipmentConstraint
): boolean {
  if (!constraint.allowedTags) return false;
  if (constraint.allowedTags.size !== 1) return false;
  return constraint.allowedTags.has(CATALOG_EQUIPMENT.BODY_WEIGHT);
}

/** Strict "no equipment": bodyweight tags AND no props beyond a wall/floor. */
export function isStrictBodyweightConstraint(constraint: EquipmentConstraint): boolean {
  if (!isBodyweightOnlyConstraint(constraint)) return false;
  const props = constraintProps(constraint);
  return [...props].every((p) => p === "wall");
}

/** Tags an exercise effectively requires (catalog + implied; empty → body weight). */
export function exerciseEquipmentTags(exercise: CatalogExercise): string[] {
  const profile = getExerciseProfile(exercise);
  const tags = profile.effectiveEquipmentTags.map(normalizeEquipmentTag);
  return tags.length ? tags : [CATALOG_EQUIPMENT.BODY_WEIGHT];
}

/**
 * Exercise passes when every effective tag is allowed, none is forbidden, and
 * every hidden prop requirement (bar, bench, chair…) is available.
 */
export function exerciseAllowedByConstraint(
  exercise: CatalogExercise,
  constraint: EquipmentConstraint
): boolean {
  return equipmentViolationReason(exercise, constraint) === null;
}

/** Human-readable reason an exercise breaks the constraint (null = allowed). */
export function equipmentViolationReason(
  exercise: CatalogExercise,
  constraint: EquipmentConstraint
): string | null {
  const tags = exerciseEquipmentTags(exercise);
  const forbidden = constraint.forbiddenTags;
  if (forbidden) {
    const bad = tags.find((t) => forbidden.has(t));
    if (bad) return `uses ${bad} (excluded)`;
  }
  if (constraint.allowedTags) {
    const bad = tags.find((t) => !constraint.allowedTags!.has(t));
    if (bad) return `needs ${bad}`;
  }
  const profile = getExerciseProfile(exercise);
  if (profile.propRequirements.length > 0) {
    const props = constraintProps(constraint);
    if (!propRequirementsSatisfied(profile, props)) {
      const missing = profile.propRequirements
        .filter((g) => !g.some((p) => p === "wall" || props.has(p)))
        .map((g) => g.map((p) => PROP_LABELS[p]).join(" or "))
        .join(" + ");
      return `needs ${missing}`;
    }
  }
  return null;
}

export function filterCatalogByEquipment(
  exercises: CatalogExercise[],
  constraint: EquipmentConstraint
): CatalogExercise[] {
  if (isUnrestricted(constraint)) return exercises;
  return exercises.filter((ex) => exerciseAllowedByConstraint(ex, constraint));
}

function constraintFromTags(
  tags: ReadonlySet<string> | null,
  promptRule: string,
  label: string,
  source: EquipmentConstraintSource,
  props?: ReadonlySet<ExerciseProp>
): EquipmentConstraint {
  return {
    allowedTags: tags,
    promptRule,
    label,
    source,
    ...(props ? { allowedProps: props } : {}),
  };
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
      "Client has full gym access — barbells, machines, cables, benches, racks, and free weights are allowed.",
      "full_gym",
      source,
      FULL_GYM_PROPS
    );
  }
  if (has("home_dumbbells")) {
    const props = new Set<ExerciseProp>(NO_PROPS);
    if (has("bench")) props.add("bench");
    if (has("pull_up_bar")) props.add("pull_up_bar");
    return constraintFromTags(
      HOME_WEIGHTS,
      "HARD CONSTRAINT: Home weights only. Allowed catalog equipment: body weight, dumbbell, kettlebell, band/resistance band, medicine/stability ball. NO barbells, cables, smith, sled, or leverage machines. Do not assume a bench, pull-up bar, or dip station unless listed.",
      "home_dumbbells",
      source,
      props
    );
  }
  if (has("outdoor")) {
    return constraintFromTags(
      OUTDOOR,
      "HARD CONSTRAINT: Outdoor / park setting. Use bodyweight and simple outdoor-friendly moves only (park bars and benches are OK). NO gym machines, barbells, cables, or smith machines.",
      "outdoor",
      source,
      OUTDOOR_PROPS
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
        STRICT_BODYWEIGHT_RULE,
        "bodyweight",
        source,
        NO_PROPS
      );
    }
  }

  // Granular iOS equipment picks → union of allowed catalog tags + props.
  const granularTags = new Set<string>([CATALOG_EQUIPMENT.BODY_WEIGHT]);
  const granularProps = new Set<ExerciseProp>(NO_PROPS);
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
        for (const t of BAND_TAGS) granularTags.add(t);
        break;
      case "barbell":
        matchedGranular = true;
        for (const t of BARBELL_TAGS) granularTags.add(t);
        break;
      case "cable":
        matchedGranular = true;
        granularTags.add(CATALOG_EQUIPMENT.CABLE);
        break;
      case "machines":
        matchedGranular = true;
        for (const tag of GYM_MACHINES) granularTags.add(tag);
        granularProps.add("gym_station");
        break;
      case "bench":
        matchedGranular = true;
        granularProps.add("bench");
        break;
      case "pull_up_bar":
        matchedGranular = true;
        granularProps.add("pull_up_bar");
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
      `HARD CONSTRAINT: Only use equipment the client listed (${labels.join(", ") || "bodyweight"}). Bodyweight is always allowed. Do NOT invent machines, barbells, cables, benches, bars, or free weights they did not select.`,
      "granular_intake",
      source,
      granularProps
    );
  }

  // Unknown combo — be conservative: bodyweight + whatever we can map.
  return constraintFromTags(
    BODYWEIGHT_ONLY,
    "HARD CONSTRAINT: Only use equipment the client listed; when unsure stay bodyweight-only (floor exercises, no props).",
    "unknown_intake",
    source,
    NO_PROPS
  );
}

const STRICT_BODYWEIGHT_RULE =
  "HARD CONSTRAINT: No equipment / bodyweight only. Every exercise MUST be doable on the floor with only the body (a wall is OK). NO dumbbells, barbells, kettlebells, bands, machines, cables, pull-up bars, dip bars, rings/TRX, benches, chairs, boxes/steps, towels, or household objects. That rules out pull-ups, chin-ups, dips (incl. bench/chair dips), inverted rows, hanging leg raises, step-ups, and incline/decline push-ups.";

// ─── Free-text equipment directives ─────────────────────────────────────────

type EquipmentNoun = {
  re: RegExp;
  label: string;
  tags?: readonly string[];
  props?: readonly ExerciseProp[];
};

/** Specific nouns first; each match consumes its text. */
const EQUIPMENT_NOUNS: EquipmentNoun[] = [
  { re: /\bsmith(?: machine)?\b/, label: "smith machine", tags: [CATALOG_EQUIPMENT.SMITH_MACHINE] },
  { re: /\bcable(?:s| machine| station)?\b/, label: "cables", tags: [CATALOG_EQUIPMENT.CABLE] },
  { re: /\bmachines?\b/, label: "machines", tags: [...GYM_MACHINES] },
  { re: /\bmedicine balls?\b|\bmed balls?\b/, label: "medicine ball", tags: [CATALOG_EQUIPMENT.MEDICINE_BALL] },
  { re: /\b(?:stability|swiss|exercise|yoga|physio) balls?\b/, label: "stability ball", tags: [CATALOG_EQUIPMENT.STABILITY_BALL] },
  { re: /\bbosu(?: balls?)?\b/, label: "bosu ball", tags: [CATALOG_EQUIPMENT.BOSU_BALL] },
  { re: /\bweight(?:ed)? vests?\b/, label: "weighted vest", tags: [CATALOG_EQUIPMENT.WEIGHTED] },
  { re: /\bdumb ?bells?\b|\bdbs?\b|\bhand weights?\b/, label: "dumbbells", tags: [CATALOG_EQUIPMENT.DUMBBELL] },
  { re: /\bkettle ?bells?\b|\bkbs?\b/, label: "kettlebells", tags: [CATALOG_EQUIPMENT.KETTLEBELL] },
  { re: /\b(?:resistance |mini |loop |elastic |booty )?bands?\b|\bresistance tubes?\b/, label: "bands", tags: BAND_TAGS },
  { re: /\bbar ?bells?\b|\bez[\s-]?bars?\b|\btrap bars?\b|\bolympic bars?\b|\bsquat racks?\b|\bpower racks?\b|\bracks?\b/, label: "barbell", tags: BARBELL_TAGS },
  { re: /\bfree weights?\b|\bweights\b|\bweight plates?\b|\bplates\b/, label: "weights", tags: WEIGHT_TAGS },
  { re: /\bdip (?:station|bars?)\b|\bparallel bars\b|\bparallettes?\b/, label: "dip station", props: ["dip_station"] },
  { re: /\bpull[\s-]?up bars?\b|\bchin[\s-]?up bars?\b|\bdoor(?:way)? bars?\b|\bmonkey bars\b|\bbar\b/, label: "pull-up bar", props: ["pull_up_bar"] },
  { re: /\brings\b|\btrx\b|\bsuspension (?:trainer|straps)\b/, label: "rings / TRX", props: ["rings_suspension"] },
  { re: /\bbench(?:es)?\b/, label: "bench", props: ["bench"] },
  { re: /\bchairs?\b|\bcouch\b|\bsofa\b/, label: "chair", props: ["chair"] },
  { re: /\bplyo box(?:es)?\b|\bboxe?s?\b|\bstep (?:box|platform)\b|\bstairs?\b|\bstaircase\b/, label: "box / step", props: ["box_step"] },
  { re: /\btowels?\b/, label: "towel", props: ["towel"] },
  { re: /\bpartner\b|\bspotter\b|\bworkout buddy\b/, label: "partner", props: ["partner"] },
  { re: /\bfurniture\b|\bhousehold (?:items?|objects?|stuff)\b/, label: "furniture / household objects", props: ["chair", "bench", "box_step", "towel"] },
];

const STRICT_PHRASE_RE =
  /\bno[\s-]?equipment\b|\bwithout (?:any )?(?:equipment|gear|weights or (?:anything|equipment))\b|\bzero equipment\b|\bequipment[\s-]?free\b|\bno gear\b|\bnothing but (?:my )?body ?weight\b|\bbody[\s-]?weight[\s-]?only\b|\bonly (?:use )?(?:my )?(?:own )?body[\s-]?weight\b|\bjust (?:my )?(?:own )?body[\s-]?weight\b|\busing (?:only )?(?:my )?(?:own )?body[\s-]?weight\b|\bbody[\s-]?weight (?:workout|session|routine|circuit|training|exercises?|plan|program|moves)\b|\bcalisthenics only\b|\bi (?:don't|do not) have (?:any )?(?:equipment|gear|anything)\b|\bi have no (?:equipment|gear)\b|\b(?:with|have|got|there's|there is) nothing\b|\bnothing at home\b|\bno (?:equipment|gear|weights) at all\b|\bpa pajisje\b|\bme peshen e trupit\b/;

const FULL_GYM_RE =
  /\bfull gym\b|\bat the gym\b|\bin the gym\b|\bgym (?:workout|session|access|equipment)\b|\bcommercial gym\b|\bi'm at the gym\b|\bi have (?:a )?gym(?: access| membership)?\b|\bi (?:go to|train at) (?:the|a) gym\b|\bi have access to (?:a )?gym\b|\beverything available\b|\ball equipment\b/;

const POSITIVE_TRIGGER_RE =
  /\b(?:with|using|use|have|has|got|own|access to|bought|only|just|equipment is|equipment:|there's|there is|i've got|plus|and)\s+(?:(?:a|an|some|my|two|2|one|pair of|pairs of|set of|light|heavy|adjustable|few|couple of|of|the|little|small|basic|home|pull[\s-]?up|resistance|mini|loop)\s+)*(?:[a-z-]+\s+(?:and|&|or)\s+(?:a |an |some |my )?|[a-z-]+,\s+(?:a |an |some |my )?)*$/;

/** Text after an equipment noun that makes it part of an exercise name. */
const EXERCISE_SUFFIX_RE =
  /^\s*(?:bench )?(?:press|presses|rows?|curls?|flyes?|flys?|raises?|squats?|lunges?|deadlifts?|dips?|pull[\s-]?aparts?|swings?|snatch|cleans?|kickbacks?|extensions?|step[\s-]?ups?|thrusters?|walks?|jumps?|pull[\s-]?ups?|pullovers?|shrugs?|crunch(?:es)?|twists?|slams?)\b/;

const POSITIVE_SUFFIX_RE =
  /^\s*(?:only|workout|session|routine|circuit|training|exercises|plan|program|at home|are available|is available)\b/;

type DirectiveBase = {
  /** null = any catalog tag. */
  tags: ReadonlySet<string> | null;
  props: ReadonlySet<ExerciseProp> | null;
  strict: boolean;
  label: string;
  description: string;
};

export type EquipmentDirectives = {
  base: DirectiveBase | null;
  addTags: Set<string>;
  forbidTags: Set<string>;
  addProps: Set<ExerciseProp>;
  forbidProps: Set<ExerciseProp>;
  forbidGym: boolean;
  /** Human-readable log of what was understood, e.g. "no bands". */
  notes: string[];
};

export function emptyEquipmentDirectives(): EquipmentDirectives {
  return {
    base: null,
    addTags: new Set(),
    forbidTags: new Set(),
    addProps: new Set(),
    forbidProps: new Set(),
    forbidGym: false,
    notes: [],
  };
}

export function hasEquipmentDirectives(d: EquipmentDirectives): boolean {
  return (
    d.base !== null ||
    d.addTags.size > 0 ||
    d.forbidTags.size > 0 ||
    d.addProps.size > 0 ||
    d.forbidProps.size > 0 ||
    d.forbidGym
  );
}

function strictBase(): DirectiveBase {
  return {
    tags: BODYWEIGHT_ONLY,
    props: NO_PROPS,
    strict: true,
    label: "request_no_equipment",
    description: "no equipment (bodyweight only)",
  };
}

function nounsIn(text: string): { noun: EquipmentNoun; index: number; length: number }[] {
  let remaining = text;
  const out: { noun: EquipmentNoun; index: number; length: number }[] = [];
  for (const noun of EQUIPMENT_NOUNS) {
    const re = new RegExp(noun.re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(remaining)) != null) {
      out.push({ noun, index: m.index, length: m[0].length });
    }
    remaining = remaining.replace(new RegExp(noun.re.source, "g"), (s) => " ".repeat(s.length));
  }
  return out.sort((a, b) => a.index - b.index);
}

function labelForExclusiveTags(tags: Set<string>): string {
  const extra = [...tags].filter((t) => t !== CATALOG_EQUIPMENT.BODY_WEIGHT);
  if (extra.length === 1 && extra[0] === CATALOG_EQUIPMENT.DUMBBELL) return "request_dumbbells_only";
  if (extra.length === 1 && extra[0] === CATALOG_EQUIPMENT.KETTLEBELL) return "request_kettlebells_only";
  if (extra.length > 0 && extra.every((t) => (BAND_TAGS as readonly string[]).includes(t))) {
    return "request_bands_only";
  }
  return "request_custom_equipment";
}

/**
 * Parse explicit equipment statements from ONE message.
 * "no equipment" / "home workout with nothing" → strict bodyweight;
 * "with dumbbells" / "dumbbells only" → bodyweight + dumbbells (nothing else);
 * "no bands" → forbid bands; "I have a pull-up bar" → add prop; "no gym" → drop gym gear.
 */
export function parseEquipmentDirectives(text: string | null | undefined): EquipmentDirectives {
  const d = emptyEquipmentDirectives();
  const normalized = normalizeUserText(text);
  if (!normalized) return d;
  const parsed = parseConstraintText(normalized);

  // 1) Strict bodyweight phrases (checked on the full text — they are self-contained).
  if (STRICT_PHRASE_RE.test(normalized)) {
    d.base = strictBase();
    d.notes.push("no equipment (strict bodyweight)");
  }

  // 2) Negated equipment: "no bands", "without a bench", "I don't have dumbbells".
  for (const span of parsed.negated) {
    if (span.kind === "reduce") continue;
    const target = span.target;
    const meansNoGear =
      /^(?:any )?(?:equipment|gear)\b/.test(target) ||
      (span.kind === "lack" && /^(?:any ?thing|anything)\b/.test(target)) ||
      (/\bequipment\b/.test(target) && !nounsIn(target).length);
    if (span.kind !== "inability" && meansNoGear) {
      if (!d.base?.strict) {
        d.base = strictBase();
        d.notes.push("no equipment (strict bodyweight)");
      }
      continue;
    }
    if (/\bgym\b/.test(target) && !/\bgym (?:ball|mat)\b/.test(target)) {
      d.forbidGym = true;
      d.notes.push("no gym access");
    }
    for (const part of splitTargetList(target)) {
      for (const { noun, index, length } of nounsIn(part)) {
        // "no bench press" / "no band pull-aparts" exclude an exercise, not the gear.
        if (EXERCISE_SUFFIX_RE.test(part.slice(index + length))) continue;
        if (noun.tags) {
          for (const t of noun.tags) d.forbidTags.add(t);
          d.notes.push(`no ${noun.label}`);
        }
        if (noun.props) {
          for (const p of noun.props) d.forbidProps.add(p);
          d.notes.push(`no ${noun.label}`);
        }
      }
    }
  }

  // 3) Positive equipment statements (only in non-negated text).
  const positive = parsed.positive;
  if (FULL_GYM_RE.test(positive) && !d.forbidGym) {
    d.base = {
      tags: null,
      props: FULL_GYM_PROPS,
      strict: false,
      label: "request_full_gym",
      description: "full gym",
    };
    d.notes.push("full gym");
  }

  const exclusiveTags = new Set<string>();
  const additive = /\b(?:also|too|as well|in addition|additionally|plus)\b/.test(positive);
  for (const { noun, index, length } of nounsIn(positive)) {
    const pre = positive.slice(Math.max(0, index - 60), index);
    const post = positive.slice(index + length, index + length + 30);
    // "dumbbell rows", "bench press" = exercise names, not gear statements.
    if (EXERCISE_SUFFIX_RE.test(post)) continue;
    const triggered = POSITIVE_TRIGGER_RE.test(pre) || POSITIVE_SUFFIX_RE.test(post);
    if (!triggered) continue;
    if (noun.tags) {
      for (const t of noun.tags) exclusiveTags.add(t);
      d.notes.push(`has ${noun.label}`);
    }
    if (noun.props) {
      for (const p of noun.props) {
        d.addProps.add(p);
        d.forbidProps.delete(p);
      }
      d.notes.push(`has ${noun.label}`);
    }
  }
  if (exclusiveTags.size > 0) {
    for (const t of exclusiveTags) d.forbidTags.delete(t);
    if (additive && !d.base) {
      for (const t of exclusiveTags) d.addTags.add(t);
    } else if (!d.base || d.base.strict) {
      // "bodyweight only… actually I have dumbbells" in one message: gear wins.
      const tags = new Set<string>([CATALOG_EQUIPMENT.BODY_WEIGHT, ...exclusiveTags]);
      d.base = {
        tags,
        props: NO_PROPS,
        strict: false,
        label: labelForExclusiveTags(tags),
        description: `bodyweight + ${[...exclusiveTags].filter((t) => t !== "resistance band").join(", ")} only`,
      };
    } else if (d.base.tags) {
      const tags = new Set(d.base.tags);
      for (const t of exclusiveTags) tags.add(t);
      d.base = { ...d.base, tags };
    }
  }

  return d;
}

/** Combine directives in chronological order — later statements win. */
export function mergeEquipmentDirectives(list: EquipmentDirectives[]): EquipmentDirectives {
  const out = emptyEquipmentDirectives();
  for (const d of list) {
    if (d.base) {
      out.base = d.base;
      out.addTags = new Set();
      out.forbidGym = false;
      if (d.base.tags) {
        for (const t of d.base.tags) out.forbidTags.delete(t);
      } else {
        out.forbidTags = new Set();
      }
      if (d.base.strict) {
        out.addProps = new Set();
        out.forbidProps = new Set();
      }
    }
    for (const t of d.addTags) {
      out.addTags.add(t);
      out.forbidTags.delete(t);
    }
    for (const t of d.forbidTags) {
      out.forbidTags.add(t);
      out.addTags.delete(t);
    }
    for (const p of d.addProps) {
      out.addProps.add(p);
      out.forbidProps.delete(p);
    }
    for (const p of d.forbidProps) {
      out.forbidProps.add(p);
      out.addProps.delete(p);
    }
    if (d.forbidGym) out.forbidGym = true;
    out.notes.push(...d.notes);
  }
  return out;
}

function describeTags(tags: ReadonlySet<string>): string {
  return [...tags]
    .filter((t) => t !== CATALOG_EQUIPMENT.RESISTANCE_BAND || !tags.has(CATALOG_EQUIPMENT.BAND))
    .sort()
    .join(", ");
}

function describeMissingProps(props: ReadonlySet<ExerciseProp>): string {
  const missing = ALL_EXERCISE_PROPS.filter((p) => p !== "wall" && p !== "partner" && !props.has(p));
  return missing.map((p) => PROP_LABELS[p]).join(", ");
}

/** Build the final prompt rule text for any constraint. */
export function describeEquipmentConstraintRule(c: {
  allowedTags: ReadonlySet<string> | null;
  forbiddenTags?: ReadonlySet<string>;
  allowedProps?: ReadonlySet<ExerciseProp>;
  strict?: boolean;
  headline?: string;
}): string {
  const props = c.allowedProps ?? (c.allowedTags === null ? FULL_GYM_PROPS : NO_PROPS);
  if (c.strict) return STRICT_BODYWEIGHT_RULE;
  const parts: string[] = [];
  if (c.headline) parts.push(c.headline);
  if (c.allowedTags) {
    parts.push(`Allowed equipment ONLY: ${describeTags(c.allowedTags)}.`);
  } else {
    parts.push("Any gym equipment is allowed.");
  }
  if (c.forbiddenTags && c.forbiddenTags.size > 0) {
    parts.push(`FORBIDDEN: ${describeTags(c.forbiddenTags)} — never use exercises that need them.`);
  }
  const available = [...props].filter((p) => p !== "wall").map((p) => PROP_LABELS[p]);
  parts.push(
    available.length
      ? `Available props: ${available.join(", ")}.`
      : "No props available (floor + wall only)."
  );
  const missing = describeMissingProps(props);
  if (missing) parts.push(`NOT available: ${missing}.`);
  return `HARD CONSTRAINT: ${parts.join(" ")}`;
}

/** Apply merged directives on top of a baseline (intake) constraint. */
export function applyEquipmentDirectives(
  baseline: EquipmentConstraint,
  d: EquipmentDirectives
): EquipmentConstraint {
  if (!hasEquipmentDirectives(d)) return baseline;

  let tags: Set<string> | null;
  let props: Set<ExerciseProp>;
  let label: string;
  let strict = false;
  if (d.base) {
    tags = d.base.tags ? new Set(d.base.tags) : null;
    props = new Set(d.base.props ?? (tags === null ? FULL_GYM_PROPS : NO_PROPS));
    label = d.base.label;
    strict = d.base.strict;
  } else {
    tags = baseline.allowedTags ? new Set(baseline.allowedTags) : null;
    props = new Set(constraintProps(baseline));
    label = `${baseline.label}+request`;
  }

  if (d.forbidGym) {
    if (tags === null) {
      tags = new Set(BODYWEIGHT_ONLY);
      props = new Set(NO_PROPS);
      if (!d.base) label = "request_no_gym";
    } else {
      for (const t of GYM_ONLY_TAGS) tags.delete(t);
    }
    props.delete("gym_station");
    props.delete("dip_station");
  }
  if (tags !== null) {
    for (const t of d.addTags) tags.add(t);
    if (d.addTags.size > 0) strict = false;
  }
  const forbidden = new Set<string>(d.forbidTags);
  if (tags !== null) {
    for (const t of forbidden) tags.delete(t);
    tags.add(CATALOG_EQUIPMENT.BODY_WEIGHT);
  }
  for (const p of d.addProps) {
    props.add(p);
    strict = false;
  }
  for (const p of d.forbidProps) props.delete(p);
  props.add("wall");

  const promptRule = describeEquipmentConstraintRule({
    allowedTags: tags,
    forbiddenTags: forbidden,
    allowedProps: props,
    strict,
    headline: d.base?.description ? `User request: ${d.base.description}.` : "User request overrides profile equipment.",
  });

  return {
    allowedTags: tags,
    promptRule,
    source: d.base ? "request" : "merged",
    label,
    allowedProps: props,
    ...(forbidden.size > 0 ? { forbiddenTags: forbidden } : {}),
  };
}

/**
 * Detect explicit equipment intent in free-text preferences / chat.
 * Returns null when the text does not clearly override equipment.
 */
export function parseEquipmentConstraintFromText(
  text: string | undefined | null
): EquipmentConstraint | null {
  const d = parseEquipmentDirectives(text);
  if (!hasEquipmentDirectives(d)) return null;
  if (!d.base) {
    // Pure exclusions ("no machines", "no bands") start from free-weight home/gym gear.
    const freeWeights = new Set<string>([...HOME_WEIGHTS, ...BARBELL_TAGS]);
    const baseline = constraintFromTags(
      freeWeights,
      "",
      d.forbidTags.has(CATALOG_EQUIPMENT.LEVERAGE_MACHINE) ? "request_no_machines" : "request_exclusions",
      "request",
      FULL_GYM_PROPS
    );
    const applied = applyEquipmentDirectives(baseline, d);
    return { ...applied, label: baseline.label, source: "request" };
  }
  return applyEquipmentDirectives(
    constraintFromTags(BODYWEIGHT_ONLY, "", "request", "request", NO_PROPS),
    d
  );
}

/**
 * Resolve the effective equipment constraint for a generation call.
 * Order (latest wins): intake → earlier conversation turns → current request text.
 */
export function resolveEquipmentConstraint(
  profile: Profile,
  preferences?: string | null,
  conversationDirectives?: EquipmentDirectives[]
): EquipmentConstraint {
  const responses: IntakeResponses = profileToResponses(profile);
  const intake = equipmentConstraintFromIntakeAccess(
    responses.equipment_access,
    "intake"
  );
  const merged = mergeEquipmentDirectives([
    ...(conversationDirectives ?? []),
    parseEquipmentDirectives(preferences),
  ]);
  return applyEquipmentDirectives(intake, merged);
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

  if (isUnrestricted(constraint)) {
    return `- Equipment: ${constraint.promptRule}${samples}`;
  }

  const tagLine = constraint.allowedTags
    ? `\n- Allowed catalog equipment tags ONLY: ${[...constraint.allowedTags].sort().join(", ")}.`
    : "";
  const forbidLine =
    constraint.forbiddenTags && constraint.forbiddenTags.size > 0
      ? `\n- Forbidden equipment: ${[...constraint.forbiddenTags].sort().join(", ")}.`
      : "";
  const props = constraintProps(constraint);
  const missing = describeMissingProps(props);
  const propLine = missing ? `\n- NOT available (do not program moves that need them): ${missing}.` : "";
  return `- ${constraint.promptRule}${tagLine}${forbidLine}${propLine}
- Never invent exercises that need other equipment. If unsure, pick a floor body-weight library name.${samples}`;
}
