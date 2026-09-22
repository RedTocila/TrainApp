/**
 * Semantic exercise matching for include/exclude constraints.
 * Matches families (squat, lunge, jump…) and resolves user phrases to catalog names.
 */

import {
  exerciseAllowedByConstraint,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import {
  BODYWEIGHT_EXERCISE_ALIASES,
  EXERCISE_NAME_ALIASES,
} from "@/lib/exercise-name-aliases";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
  getCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";

export type ExerciseFamilyId =
  | "squat"
  | "lunge"
  | "deadlift"
  | "bench_press"
  | "row"
  | "press"
  | "curl"
  | "push_up"
  | "pull_up"
  | "plank"
  | "jump"
  | "burpee"
  | "hip_thrust"
  | "leg_press"
  | "crunch";

export type ExerciseFamily = {
  id: ExerciseFamilyId;
  /** User-facing label for conflict / prompt messages. */
  label: string;
  /** Matches catalog or free-form exercise names. */
  namePattern: RegExp;
  /** Tokens that refer to this family in user text. */
  mentionPatterns: RegExp[];
};

export const EXERCISE_FAMILIES: ExerciseFamily[] = [
  {
    id: "squat",
    label: "squats",
    namePattern: /\bsquat/i,
    mentionPatterns: [/\bsquats?\b/i],
  },
  {
    id: "lunge",
    label: "lunges",
    namePattern: /\blunge|\bsplit\s*squat|\bbulgarian\b/i,
    mentionPatterns: [/\blunges?\b/i, /\bbulgarian\s*(split\s*)?squats?\b/i],
  },
  {
    id: "deadlift",
    label: "deadlifts",
    namePattern: /\bdeadlift/i,
    mentionPatterns: [/\bdeadlifts?\b/i, /\brdls?\b/i],
  },
  {
    id: "bench_press",
    label: "bench press",
    namePattern: /\bbench\s*press/i,
    mentionPatterns: [/\bbench\s*press(es)?\b/i],
  },
  {
    id: "row",
    label: "rows",
    namePattern: /\brow\b/i,
    mentionPatterns: [/\brows?\b/i],
  },
  {
    id: "press",
    label: "overhead press",
    namePattern: /\b(overhead|shoulder|military)\s*press|\bseated\s*overhead\s*press/i,
    mentionPatterns: [
      /\b(overhead|shoulder|military)\s*press(es)?\b/i,
    ],
  },
  {
    id: "curl",
    label: "curls",
    namePattern: /\bcurl/i,
    mentionPatterns: [/\b(bicep|biceps)?\s*curls?\b/i],
  },
  {
    id: "push_up",
    label: "push-ups",
    namePattern: /\bpush[\s-]?ups?\b/i,
    mentionPatterns: [/\bpush[\s-]?ups?\b/i, /\bpushups?\b/i],
  },
  {
    id: "pull_up",
    label: "pull-ups",
    namePattern: /\bpull[\s-]?ups?\b|\bchin[\s-]?ups?\b/i,
    mentionPatterns: [/\bpull[\s-]?ups?\b/i, /\bpullups?\b/i, /\bchin[\s-]?ups?\b/i],
  },
  {
    id: "plank",
    label: "planks",
    namePattern: /\bplank/i,
    mentionPatterns: [/\bplanks?\b/i],
  },
  {
    id: "jump",
    label: "jumping / plyometric moves",
    namePattern: /\bjump|\bplyo|\bhop\b|\bbox\s*jump/i,
    mentionPatterns: [/\bjump(ing)?\b/i, /\bplyometrics?\b/i],
  },
  {
    id: "burpee",
    label: "burpees",
    namePattern: /\bburpee/i,
    mentionPatterns: [/\bburpees?\b/i],
  },
  {
    id: "hip_thrust",
    label: "hip thrusts / glute bridges",
    namePattern: /\bhip\s*thrust|\bglute\s*bridge/i,
    mentionPatterns: [/\bhip\s*thrusts?\b/i, /\bglute\s*bridges?\b/i],
  },
  {
    id: "leg_press",
    label: "leg press",
    namePattern: /\bleg\s*press/i,
    mentionPatterns: [/\bleg\s*press(es)?\b/i],
  },
  {
    id: "crunch",
    label: "crunches",
    namePattern: /\bcrunch|\bsit[\s-]?up/i,
    mentionPatterns: [/\bcrunches?\b/i, /\bsit[\s-]?ups?\b/i],
  },
];

export type ResolvedExerciseRef = {
  /** Original user phrase. */
  query: string;
  /** Best catalog match when found. */
  catalogName: string | null;
  catalogId: string | null;
  /** Family ids this exercise belongs to. */
  families: ExerciseFamilyId[];
  /** Equipment tags from catalog (empty if unresolved). */
  equipment: string[];
};

function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

export function familiesForExerciseName(name: string): ExerciseFamilyId[] {
  return EXERCISE_FAMILIES.filter((f) => f.namePattern.test(name)).map(
    (f) => f.id
  );
}

export function exerciseMatchesFamily(
  name: string,
  familyId: ExerciseFamilyId
): boolean {
  const family = EXERCISE_FAMILIES.find((f) => f.id === familyId);
  if (!family) return false;
  return family.namePattern.test(name);
}

export function exerciseMatchesAnyFamily(
  name: string,
  familyIds: ExerciseFamilyId[]
): boolean {
  return familyIds.some((id) => exerciseMatchesFamily(name, id));
}

/** Detect exercise families the user asked to avoid/exclude. */
export function parseExcludedFamiliesFromText(text: string): ExerciseFamilyId[] {
  const t = text.toLowerCase();
  const found = new Set<ExerciseFamilyId>();

  // "no jumping" / "don't use jumping" / "avoid jumps"
  if (
    /\b(no|without|avoid|don'?t\s+(use|include|want)|do\s+not\s+(use|include))\s+(any\s+)?(jump(ing)?|plyometrics?)\b/.test(
      t
    ) ||
    /\b(no|avoid)\s+high[\s-]?impact\b/.test(t)
  ) {
    found.add("jump");
    found.add("burpee");
  }

  for (const family of EXERCISE_FAMILIES) {
    for (const pattern of family.mentionPatterns) {
      const mention = pattern.source;
      const excludeRe = new RegExp(
        String.raw`\b(?:no|without|avoid|exclude|don'?t\s+(?:include|use|want)|do\s+not\s+(?:include|use)|remove)\s+(?:any\s+)?(?:more\s+)?${mention}`,
        "i"
      );
      // Also: "don't include squats" already covered; "squats are off limits"
      const offLimits = new RegExp(
        String.raw`${mention}\s+(?:are\s+)?(?:off[\s-]?limits|forbidden|banned)`,
        "i"
      );
      if (excludeRe.test(t) || offLimits.test(t)) {
        found.add(family.id);
      }
    }
  }

  return [...found];
}

/**
 * Extract required exercise phrases: "include push-ups", "use push-ups and mountain climbers".
 */
export function parseRequiredExercisePhrases(text: string): string[] {
  const phrases: string[] = [];
  const patterns = [
    /\b(?:include|must\s+include|must\s+have|using|use|with)\s+([a-z0-9][a-z0-9\s\-_/,&]+?)(?:\s+(?:but|and\s+also\s+make|please)|[.!?\n]|$)/gi,
    /\b(?:add)\s+([a-z0-9][a-z0-9\s\-/]+?)(?:\s+(?:to\s+(?:the|this)\s+workout)|[.!?\n]|$)/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) != null) {
      const chunk = m[1] ?? "";
      // Skip equipment-only clauses ("no equipment", "dumbbells only")
      if (
        /\b(equipment|dumbbells?|barbells?|machines?|bands?|kettlebells?|minutes?|min)\b/i.test(
          chunk
        ) &&
        !/\b(push[\s-]?ups?|pull[\s-]?ups?|squats?|lunges?|press(es)?|curls?|planks?|rows?|bridges?|climbers?|burpees?|deadlifts?|bench)\b/i.test(
          chunk
        )
      ) {
        continue;
      }
      for (const part of splitExerciseList(chunk)) {
        if (part.length >= 3) phrases.push(part);
      }
    }
  }

  return [...new Set(phrases.map(normalizePhrase))].filter(Boolean);
}

/**
 * Extract excluded exercise phrases beyond family detection:
 * "don't include Bulgarian split squat"
 */
export function parseExcludedExercisePhrases(text: string): string[] {
  const phrases: string[] = [];
  const re =
    /\b(?:don'?t\s+(?:include|use|want)|do\s+not\s+(?:include|use)|exclude|without|remove)\s+([a-z0-9][a-z0-9\s\-/]+?)(?:\s+(?:from|please)|[.!?\n]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    const chunk = m[1] ?? "";
    if (
      /\b(equipment|machines?|jumping|plyometrics?)\b/i.test(chunk) &&
      !/\b(push[\s-]?ups?|pull[\s-]?ups?|squats?|lunges?|press(es)?|curls?|planks?|rows?|bridges?|burpees?|deadlifts?|bench)\b/i.test(
        chunk
      )
    ) {
      continue;
    }
    for (const part of splitExerciseList(chunk)) {
      if (part.length >= 3) phrases.push(part);
    }
  }
  return [...new Set(phrases.map(normalizePhrase))].filter(Boolean);
}

function splitExerciseList(chunk: string): string[] {
  return chunk
    .split(/\s*(?:,|&|\/| and |\+)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3 && !/^(the|a|an|some|any|only)$/i.test(p));
}

export function resolveExerciseRef(
  query: string,
  equipment?: EquipmentConstraint | null
): ResolvedExerciseRef {
  // Normalize hyphens so "push-ups" hits aliases / catalog "push-up".
  const normalizedQuery = normalizePhrase(query);
  const catalog = findCatalogExercise(normalizedQuery, {
    equipment: equipment ?? null,
  });
  const canon = canonicalizeAiExerciseName(normalizedQuery, {
    equipment: equipment ?? null,
  });
  const resolved =
    catalog ??
    findCatalogExercise(canon, { equipment: equipment ?? null }) ??
    findCatalogExercise(normalizedQuery) ??
    findCatalogExercise(query);

  // Prefer alias table when catalog fuzzy match fails under constraint.
  if (!resolved || (equipment && !exerciseAllowedByConstraint(resolved, equipment))) {
    const norm = normalizedQuery;
    const alias =
      (equipment?.allowedTags?.size === 1
        ? BODYWEIGHT_EXERCISE_ALIASES[norm]
        : undefined) ??
      EXERCISE_NAME_ALIASES[norm] ??
      BODYWEIGHT_EXERCISE_ALIASES[norm];
    if (alias) {
      const aliased = findCatalogExercise(alias, {
        equipment: equipment ?? null,
      });
      if (aliased) {
        return {
          query,
          catalogName: aliased.name,
          catalogId: aliased.id,
          families: familiesForExerciseName(aliased.name),
          equipment: aliased.equipment,
        };
      }
    }
  }

  if (resolved) {
    return {
      query,
      catalogName: resolved.name,
      catalogId: resolved.id,
      families: familiesForExerciseName(resolved.name),
      equipment: resolved.equipment,
    };
  }

  return {
    query,
    catalogName: null,
    catalogId: null,
    families: familiesForExerciseName(query),
    equipment: [],
  };
}

/** Catalog exercises matching an excluded family under the equipment allowlist. */
export function catalogExercisesInFamily(
  familyId: ExerciseFamilyId,
  equipment?: EquipmentConstraint | null
): CatalogExercise[] {
  return getCatalogExercises().filter((ex) => {
    if (equipment && !exerciseAllowedByConstraint(ex, equipment)) return false;
    return exerciseMatchesFamily(ex.name, familyId);
  });
}
