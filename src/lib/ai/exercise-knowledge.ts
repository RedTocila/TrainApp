/**
 * Catalog-aware exercise knowledge: hard filters (equipment, avoided muscles,
 * injuries, difficulty, impact, excluded families) and deterministic
 * pattern-aware substitutions / regressions.
 */

import {
  equipmentViolationReason,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import {
  getExerciseProfile,
  type DifficultyTier,
  type ExerciseProfile,
  type JointArea,
  type MovementPattern,
  type MuscleGroupId,
} from "@/lib/ai/exercise-profile";
import {
  exerciseMatchesAnyFamily,
  familiesForExerciseName,
  type ExerciseFamilyId,
} from "@/lib/ai/exercise-semantic-match";
import {
  findCatalogExercise,
  getCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";

export type ExerciseFilter = {
  equipment?: EquipmentConstraint | null;
  avoidGroups?: readonly MuscleGroupId[];
  injuries?: readonly JointArea[];
  maxDifficulty?: DifficultyTier | null;
  lowImpact?: boolean;
  excludedFamilies?: readonly ExerciseFamilyId[];
  /** Lowercased catalog names that are explicitly excluded. */
  excludedNames?: readonly string[];
  /** Mobility/stretch moves ignore muscle-avoid + difficulty (still obey equipment/injury). */
  relaxForMobility?: boolean;
};

export type ExerciseRejectionCode =
  | "equipment"
  | "excluded_family"
  | "excluded_name"
  | "avoided_muscle"
  | "injury"
  | "difficulty"
  | "impact";

export type ExerciseRejection = { code: ExerciseRejectionCode; detail: string };

const LEG_GROUPS: MuscleGroupId[] = ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"];
const LEG_PATTERNS = new Set<MovementPattern>([
  "squat",
  "lunge",
  "hinge",
  "hip_extension",
  "hip_abduction",
  "knee_flexion",
  "calf",
]);
const LEG_DOMINANT_NAME_RE = /jump|squat|lunge|\bhop|skater|bound|burpee|step[\s-]?up|pistol|leg press|leg curl|leg extension|calf/;

function avoidedGroupHit(
  profile: ExerciseProfile,
  avoid: ReadonlySet<MuscleGroupId>
): MuscleGroupId | null {
  for (const g of profile.primaryGroups) if (avoid.has(g)) return g;
  const name = profile.name.toLowerCase();
  const legsAvoided = LEG_GROUPS.filter((g) => avoid.has(g)).length >= 3;
  if (legsAvoided) {
    if (LEG_PATTERNS.has(profile.pattern)) return "quads";
    if (LEG_DOMINANT_NAME_RE.test(name)) return "quads";
  }
  const shouldersAvoided = avoid.has("front_delts") && avoid.has("side_delts");
  if (shouldersAvoided && profile.pattern === "vertical_push") return "front_delts";
  const chestAvoided = avoid.has("chest");
  if (chestAvoided && /\bfly\b|flye|chest press|bench press|push[\s-]?up/.test(name) && !profile.primaryGroups.includes("triceps")) {
    return "chest";
  }
  return null;
}

/** Why an exercise fails the filter (null = allowed). Deterministic, no LLM. */
export function exerciseRejection(
  ex: CatalogExercise,
  filter: ExerciseFilter
): ExerciseRejection | null {
  const profile = getExerciseProfile(ex);
  const lowerName = ex.name.toLowerCase();

  if (filter.equipment) {
    const reason = equipmentViolationReason(ex, filter.equipment);
    if (reason) return { code: "equipment", detail: reason };
  }
  if (filter.excludedFamilies?.length && exerciseMatchesAnyFamily(ex.name, [...filter.excludedFamilies])) {
    return { code: "excluded_family", detail: familiesForExerciseName(ex.name).join(", ") || "excluded movement" };
  }
  if (filter.excludedNames?.includes(lowerName)) {
    return { code: "excluded_name", detail: ex.name };
  }
  const relax = (filter.relaxForMobility ?? true) && profile.isMobility;
  if (!relax && filter.avoidGroups?.length) {
    const hit = avoidedGroupHit(profile, new Set(filter.avoidGroups));
    if (hit) return { code: "avoided_muscle", detail: hit.replace(/_/g, " ") };
  }
  if (filter.injuries?.length) {
    const joint = profile.highStressJoints.find((j) => filter.injuries!.includes(j));
    if (joint) return { code: "injury", detail: `high ${joint} stress` };
  }
  if (!relax && filter.maxDifficulty != null && profile.difficulty > filter.maxDifficulty) {
    return { code: "difficulty", detail: `tier ${profile.difficulty} > ${filter.maxDifficulty}` };
  }
  if (filter.lowImpact && profile.impact === "high") {
    return { code: "impact", detail: "high impact" };
  }
  return null;
}

export function exercisePassesFilter(ex: CatalogExercise, filter: ExerciseFilter): boolean {
  return exerciseRejection(ex, filter) === null;
}

/** Catalog lookup by (possibly free-form) name; tries constrained match first. */
export function lookupExercise(
  name: string,
  equipment?: EquipmentConstraint | null
): CatalogExercise | null {
  return (
    (equipment ? findCatalogExercise(name, { equipment }) : null) ??
    findCatalogExercise(name)
  );
}

// ─── Substitution scoring ──────────────────────────────────────────────────

/** Well-known moves preferred when several candidates tie. */
const COMMON_NAMES = new Set(
  [
    "push-up",
    "wide hand push up",
    "close-grip push-up",
    "diamond push-up",
    "kneeling push-up (male)",
    "push-up (wall)",
    "pull-up",
    "chin-up",
    "inverted row",
    "walking lunge",
    "forward lunge (male)",
    "split squats",
    "low glute bridge on floor",
    "single leg bridge with outstretched leg",
    "glute bridge march",
    "side hip abduction",
    "dead bug",
    "front plank with twist",
    "mountain climber",
    "crunch floor",
    "reverse crunch",
    "russian twist",
    "bodyweight standing calf raise",
    "squat to overhead reach",
    "burpee",
    "jump squat",
    "triceps press",
    "bodyweight kneeling triceps extension",
    "dumbbell bench press",
    "dumbbell floor press",
    "dumbbell goblet squat",
    "dumbbell bent over row",
    "dumbbell one arm bent-over row",
    "dumbbell standing overhead press",
    "dumbbell lateral raise",
    "dumbbell romanian deadlift",
    "dumbbell lunge",
    "dumbbell hammer curl",
    "dumbbell biceps curl",
    "dumbbell stiff leg deadlift",
    "barbell bench press",
    "barbell full squat",
    "barbell bent over row",
    "barbell deadlift",
    "barbell romanian deadlift",
    "barbell hip thrust",
    "cable seated row",
    "cable pulldown",
    "lever seated leg curl",
    "lever leg extension",
  ].map((n) => n.toLowerCase())
);

const AWKWARD_NAME_RE = /\((?:male|female)\)|v\.\s*\d|elite|extreme|athletic variation|micro|macro|with (?:blunt|bent|static|complex|intense|mega|compound|triple|reverse|modified|elevated)|weak\b|compressed|expanded/i;

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((t) => t.length > 2 && !["the", "with", "and", "male", "female"].includes(t))
  );
}

export type AlternativeOptions = {
  filter: ExerciseFilter;
  /** Candidate universe (defaults to full catalog). */
  pool?: readonly CatalogExercise[];
  /** Lowercased names already used in the session/plan. */
  usedNames?: ReadonlySet<string>;
  /** When true, never return the same family (e.g. replacing "squats"). */
  avoidSameFamily?: boolean;
  /** Extra families to avoid besides the original's. */
  avoidFamilies?: readonly ExerciseFamilyId[];
  /** Preferred muscle groups (session focus). */
  preferGroups?: readonly MuscleGroupId[];
  /** Target difficulty; defaults to the original's tier. */
  targetTier?: DifficultyTier;
  /** Only accept candidates at or below this tier (regressions). */
  maxTier?: DifficultyTier;
};

function scoreAlternative(
  cand: CatalogExercise,
  candProfile: ExerciseProfile,
  orig: ExerciseProfile | null,
  origTokens: Set<string>,
  opts: AlternativeOptions
): number {
  let score = 0;
  if (orig) {
    if (candProfile.pattern === orig.pattern) score += 6;
    const primaryShared = candProfile.primaryGroups.filter((g) => orig.primaryGroups.includes(g)).length;
    score += Math.min(2, primaryShared) * 3;
    const secondaryShared = candProfile.secondaryGroups.filter(
      (g) => orig.primaryGroups.includes(g) || orig.secondaryGroups.includes(g)
    ).length;
    score += Math.min(2, secondaryShared) * 0.75;
    const tier = opts.targetTier ?? orig.difficulty;
    score -= Math.abs(candProfile.difficulty - tier) * 1.5;
    if (candProfile.isMobility !== orig.isMobility) score -= 8;
    let shared = 0;
    for (const t of nameTokens(cand.name)) if (origTokens.has(t)) shared += 1;
    score += Math.min(3, shared) * 0.6;
  }
  if (opts.preferGroups?.length) {
    const hit = candProfile.primaryGroups.some((g) => opts.preferGroups!.includes(g));
    if (hit) score += 2.5;
  }
  if (COMMON_NAMES.has(cand.name.toLowerCase())) score += 2;
  if (AWKWARD_NAME_RE.test(cand.name)) score -= 2;
  if (cand.name.length > 40) score -= 1;
  if (opts.usedNames?.has(cand.name.toLowerCase())) score -= 20;
  return score;
}

/**
 * Best substitute for `original` that satisfies every hard filter.
 * Deterministic: ties break alphabetically.
 */
export function pickAlternative(
  original: CatalogExercise | string | null,
  opts: AlternativeOptions
): CatalogExercise | null {
  const origEx =
    typeof original === "string"
      ? lookupExercise(original, null)
      : original;
  const origProfile = origEx ? getExerciseProfile(origEx) : null;
  const origName = typeof original === "string" ? original : origEx?.name ?? "";
  const origTokens = nameTokens(origName);
  const avoidFamilies = new Set<ExerciseFamilyId>(opts.avoidFamilies ?? []);
  if (opts.avoidSameFamily) {
    for (const f of familiesForExerciseName(origName)) avoidFamilies.add(f);
    if (origEx) for (const f of familiesForExerciseName(origEx.name)) avoidFamilies.add(f);
  }

  const universe = opts.pool ?? getCatalogExercises();
  let best: CatalogExercise | null = null;
  let bestScore = -Infinity;
  for (const cand of universe) {
    if (origEx && cand.id === origEx.id) continue;
    if (cand.name.toLowerCase() === origName.toLowerCase()) continue;
    if (!exercisePassesFilter(cand, opts.filter)) continue;
    if (avoidFamilies.size > 0 && exerciseMatchesAnyFamily(cand.name, [...avoidFamilies])) continue;
    const profile = getExerciseProfile(cand);
    if (opts.maxTier != null && profile.difficulty > opts.maxTier) continue;
    const score = scoreAlternative(cand, profile, origProfile, origTokens, opts);
    if (
      score > bestScore ||
      (score === bestScore && best && cand.name.localeCompare(best.name) < 0)
    ) {
      best = cand;
      bestScore = score;
    }
  }
  return best;
}

/** Up to `limit` distinct alternatives, best first (for "what can I do instead of X?"). */
export function suggestAlternatives(
  original: CatalogExercise | string,
  opts: AlternativeOptions & { limit?: number }
): CatalogExercise[] {
  const out: CatalogExercise[] = [];
  const used = new Set(opts.usedNames ?? []);
  const limit = opts.limit ?? 4;
  const usedPatterns = new Map<string, number>();
  for (let i = 0; i < limit * 3 && out.length < limit; i += 1) {
    const pick = pickAlternative(original, { ...opts, usedNames: used });
    if (!pick) break;
    used.add(pick.name.toLowerCase());
    // Keep the list varied: at most two picks per movement pattern.
    const pattern = getExerciseProfile(pick).pattern;
    const n = usedPatterns.get(pattern) ?? 0;
    if (n >= 2) continue;
    usedPatterns.set(pattern, n + 1);
    out.push(pick);
  }
  return out;
}

/**
 * Easier progression of the same movement (pistol squat → split squat,
 * pull-up → inverted row / band-assisted, handstand push-up → pike push-up).
 */
export function regressionFor(
  original: CatalogExercise | string,
  maxTier: DifficultyTier,
  filter: ExerciseFilter
): CatalogExercise | null {
  return pickAlternative(original, {
    filter: { ...filter, maxDifficulty: maxTier },
    maxTier,
    targetTier: maxTier,
  });
}

export function exerciseDifficulty(ex: CatalogExercise): DifficultyTier {
  return getExerciseProfile(ex).difficulty;
}

export const DIFFICULTY_LABEL: Record<DifficultyTier, string> = {
  1: "beginner",
  2: "intermediate",
  3: "advanced",
  4: "elite skill",
};
