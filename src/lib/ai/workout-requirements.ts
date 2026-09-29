/**
 * Structured workout requirements extracted from user text + profile intake.
 * Hard constraints are validated in code; the LLM receives them as authoritative rules.
 */

import {
  equipmentViolationReason,
  exerciseAllowedByConstraint,
  resolveEquipmentConstraint,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import {
  exerciseMatchesAnyFamily,
  parseRequiredExercisePhrases,
  resolveExerciseRef,
  type ExerciseFamilyId,
  type ResolvedExerciseRef,
  EXERCISE_FAMILIES,
} from "@/lib/ai/exercise-semantic-match";
import {
  constraintsFromConversation,
  type CoachConstraints,
  type ExperienceLevel,
} from "@/lib/ai/coach-constraints";
import {
  describeMuscleGroups,
  parseConstraintText,
  type DayFocusId,
} from "@/lib/ai/constraint-language";
import {
  ALL_JOINT_AREAS,
  getExerciseProfile,
  type DifficultyTier,
  type JointArea,
  type MuscleGroupId,
} from "@/lib/ai/exercise-profile";
import {
  DIFFICULTY_LABEL,
  exerciseRejection,
  regressionFor,
  type ExerciseFilter,
} from "@/lib/ai/exercise-knowledge";
import { findCatalogExercise } from "@/lib/exercise-catalog";
import { profileToResponses } from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

export type WorkoutFocus =
  | "full_body"
  | "upper_body"
  | "lower_body"
  | "push"
  | "pull"
  | "legs"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "glutes"
  | "core"
  | "hiit"
  | "cardio"
  | "mobility";

export type WorkoutDifficultyReq = "beginner" | "intermediate" | "advanced";

export type WorkoutLocationReq = "home" | "gym" | "outdoor";

export type WorkoutRequirements = {
  equipment: EquipmentConstraint;
  focus: WorkoutFocus[];
  durationMinutes: number | null;
  difficulty: WorkoutDifficultyReq | null;
  exerciseCount: number | null;
  requiredExercises: ResolvedExerciseRef[];
  excludedExercises: ResolvedExerciseRef[];
  excludedFamilies: ExerciseFamilyId[];
  location: WorkoutLocationReq | null;
  varietyLevel: "normal" | "high";
  rawText: string;
  /** HARD: muscle groups the user said not to train ("without shoulders"). */
  avoidMuscles: MuscleGroupId[];
  /** Soft: groups to give less volume ("less arms"). */
  reduceMuscles: MuscleGroupId[];
  /** Fine-grained focus groups for bias (glutes, upper chest, hamstrings…). */
  focusGroups: MuscleGroupId[];
  /** HARD: joints to protect (profile injuries + mentioned pain). */
  injuries: JointArea[];
  /** HARD: no jumping / high-impact moves. */
  lowImpact: boolean;
  /** HARD: highest allowed exercise difficulty tier (null = no cap). */
  maxDifficulty: DifficultyTier | null;
  /** Experience used for programming (request > profile). */
  experience: ExperienceLevel | null;
  difficultySource: "request" | "profile" | null;
  /** Training days per week requested in text (weekly programs). */
  daysPerWeek: number | null;
  /** Day types the user asked to remove / not schedule ("no leg day"). */
  excludedDayFocuses: DayFocusId[];
  /** Human-readable notes about automatic adjustments (regressions etc.). */
  adjustments: string[];
  /** Merged constraint extraction (for prompts / validation reports). */
  constraints: CoachConstraints;
};

export type RequirementsContext = {
  /** Chronological user turns of the conversation; the latest turn LAST. */
  conversation?: readonly string[];
  /** Plan being edited already exists (affects intent classification). */
  hasExistingPlan?: boolean;
};

/** Max difficulty tier per experience level. */
export const EXPERIENCE_MAX_TIER: Record<ExperienceLevel, DifficultyTier> = {
  beginner: 1,
  intermediate: 3,
  advanced: 4,
};

/** Hard exercise filter derived from requirements (equipment + safety + exclusions). */
export function exerciseFilterFromRequirements(
  requirements: WorkoutRequirements,
  options?: { forMobility?: boolean }
): ExerciseFilter {
  const excludedNames = requirements.excludedExercises
    .map((r) => r.catalogName?.toLowerCase())
    .filter((n): n is string => !!n);
  return {
    equipment: requirements.equipment,
    avoidGroups: options?.forMobility ? [] : requirements.avoidMuscles,
    injuries: requirements.injuries,
    maxDifficulty: options?.forMobility ? null : requirements.maxDifficulty,
    lowImpact: requirements.lowImpact,
    excludedFamilies: requirements.excludedFamilies,
    excludedNames,
    relaxForMobility: true,
  };
}

export type RequirementConflict = {
  code:
    | "required_vs_equipment"
    | "required_vs_excluded"
    | "required_unresolved"
    | "required_vs_family_exclude"
    | "required_vs_avoided_muscle";
  hard: true;
  message: string;
  /** Short options the coach can offer the user. */
  options: string[];
};

export class WorkoutRequirementConflictError extends Error {
  readonly conflicts: RequirementConflict[];
  readonly requirements: WorkoutRequirements;

  constructor(
    conflicts: RequirementConflict[],
    requirements: WorkoutRequirements
  ) {
    super(conflicts.map((c) => c.message).join("\n\n"));
    this.name = "WorkoutRequirementConflictError";
    this.conflicts = conflicts;
    this.requirements = requirements;
  }
}

function parseFocus(text: string): WorkoutFocus[] {
  const t = text.toLowerCase();
  const focus: WorkoutFocus[] = [];
  const add = (f: WorkoutFocus) => {
    if (!focus.includes(f)) focus.push(f);
  };

  if (/\bfull[\s-]?body\b/.test(t)) add("full_body");
  if (/\bupper([\s-]?body)?\b/.test(t) && !/\blower\b/.test(t)) add("upper_body");
  if (/\blower([\s-]?body)?\b/.test(t)) add("lower_body");
  if (
    /\bpush\b/.test(t) &&
    !/\bpull\b/.test(t) &&
    !/\bpush[\s-]?ups?\b/.test(t)
  ) {
    add("push");
  }
  if (/\bpull\b/.test(t) && !/\bpull[\s-]?ups?\b/.test(t)) add("pull");
  if (/\blegs?\b/.test(t) && !/\bleg\s*press|\bleg\s*curl|\bleg\s*extension\b/.test(t)) {
    add("legs");
  }
  if (/\bchest\b/.test(t)) add("chest");
  if (/\bback\b/.test(t) && !/\blower\s+back\b/.test(t)) add("back");
  if (/\bshoulders?\b/.test(t)) add("shoulders");
  if (/\barms?\b|\bbiceps?\b|\btriceps?\b/.test(t)) add("arms");
  if (/\bglutes?\b|\bbooty\b|\bbutt\b/.test(t)) add("glutes");
  if (/\bcore\b|\babs?\b/.test(t)) add("core");
  if (/\bhiit\b|\btabata\b/.test(t)) add("hiit");
  if (/\bcardio\b/.test(t)) add("cardio");
  if (/\bmobility\b|\bstretch/.test(t)) add("mobility");

  return focus;
}

function parseDurationMinutes(text: string): number | null {
  const m = text.match(
    /\b(\d{1,3})\s*(?:-\s*\d{1,3}\s*)?(?:min(?:ute)?s?)\b/i
  );
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (!Number.isFinite(n) || n < 5 || n > 180) return null;
  return n;
}

function parseDifficulty(text: string): WorkoutDifficultyReq | null {
  const t = text.toLowerCase();
  if (/\b(beginner|easy|easier|novice)\b/.test(t)) return "beginner";
  if (/\b(advanced|hard|harder|difficult|expert)\b/.test(t)) return "advanced";
  if (/\b(intermediate|moderate)\b/.test(t)) return "intermediate";
  return null;
}

function parseExerciseCount(text: string): number | null {
  const m = text.match(/\b(?:exactly\s+)?(\d{1,2})\s+exercises?\b/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (!Number.isFinite(n) || n < 1 || n > 20) return null;
  return n;
}

function parseLocation(text: string): WorkoutLocationReq | null {
  const t = text.toLowerCase();
  if (
    /\bat\s+home\b|\bhome\s+workout\b|\bhome[\s-]?based\b|\bhome\s+full[\s-]?body\b|\b(a|an|the)\s+home\b/.test(
      t
    ) ||
    /\bhome\b/.test(t)
  ) {
    // "home dumbbells" / "home weights" alone are equipment, not location — still home.
    return "home";
  }
  if (/\bat\s+the\s+gym\b|\bgym\s+workout\b|\bin\s+the\s+gym\b/.test(t)) {
    return "gym";
  }
  if (/\boutdoor\b|\bpark\b/.test(t)) return "outdoor";
  return null;
}

function parseVarietyLevel(text: string): "normal" | "high" {
  const t = text.toLowerCase();
  if (
    /\b(something\s+different|completely\s+different|totally\s+different|more\s+variety|don'?t\s+repeat|haven'?t\s+done\s+recently)\b/.test(
      t
    )
  ) {
    return "high";
  }
  return "normal";
}

const FOCUS_GROUPS: Partial<Record<WorkoutFocus, MuscleGroupId[]>> = {
  upper_body: ["chest", "upper_chest", "lats", "upper_back", "traps", "front_delts", "side_delts", "rear_delts", "biceps", "triceps"],
  lower_body: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  legs: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  push: ["chest", "upper_chest", "front_delts", "side_delts", "triceps"],
  pull: ["lats", "upper_back", "traps", "rear_delts", "biceps"],
  chest: ["chest", "upper_chest"],
  back: ["lats", "upper_back", "traps"],
  shoulders: ["front_delts", "side_delts", "rear_delts"],
  arms: ["biceps", "triceps", "forearms"],
  glutes: ["glutes", "abductors"],
  core: ["core", "obliques"],
};

/** A focus is dropped when (almost) all of its muscles are explicitly avoided. */
function focusBlockedByAvoid(focus: WorkoutFocus, avoid: ReadonlySet<MuscleGroupId>): boolean {
  const groups = FOCUS_GROUPS[focus];
  if (!groups?.length || avoid.size === 0) return false;
  const blocked = groups.filter((g) => avoid.has(g)).length;
  return blocked / groups.length >= 0.6;
}

function profileExperience(profile: Profile): ExperienceLevel | null {
  const v = profileToResponses(profile).training_experience;
  return v === "beginner" || v === "intermediate" || v === "advanced" ? v : null;
}

function profileInjuries(profile: Profile): JointArea[] {
  const areas = profileToResponses(profile).injury_areas ?? [];
  return areas.filter((a): a is JointArea => (ALL_JOINT_AREAS as readonly string[]).includes(a));
}

/**
 * Build structured requirements from profile intake + free-text request +
 * conversation. Priority: latest explicit user instruction > earlier explicit
 * constraints > safety (injuries) > profile defaults.
 */
export function resolveWorkoutRequirements(
  profile: Profile,
  preferences?: string | null,
  context?: RequirementsContext
): WorkoutRequirements {
  const rawText = preferences?.trim() ?? "";
  const conversation = context?.conversation ?? [];
  const constraints = constraintsFromConversation(conversation, rawText, {
    hasExistingPlan: context?.hasExistingPlan,
  });
  const currentText = [rawText, conversation.length ? conversation[conversation.length - 1] : ""]
    .filter(Boolean)
    .join("\n");
  const currentPositive = parseConstraintText(currentText).positive;
  // constraints.equipment is already merged in order: earlier turns → preferences → latest turn.
  const equipment = resolveEquipmentConstraint(profile, null, [constraints.equipment]);
  const responses = profileToResponses(profile);

  const requestedDifficulty = parseDifficulty(currentPositive);
  const experience = constraints.experience_level ?? profileExperience(profile);
  let difficulty: WorkoutDifficultyReq | null = requestedDifficulty ?? experience;
  const difficultySource: WorkoutRequirements["difficultySource"] = requestedDifficulty
    ? "request"
    : experience
      ? "profile"
      : null;
  if (!difficulty) difficulty = null;
  // Cap: an explicit "advanced workout" lifts the cap; beginners stay on tier 1.
  const capLevel: ExperienceLevel | null =
    requestedDifficulty === "advanced" && experience === "beginner" && !constraints.experience_override
      ? "intermediate"
      : requestedDifficulty ?? experience;
  const maxDifficulty: DifficultyTier | null = capLevel ? EXPERIENCE_MAX_TIER[capLevel] : 3;

  let location = constraints.location ?? parseLocation(currentPositive);
  if (!location) {
    const access = responses.equipment_access ?? [];
    if (access.includes("full_gym")) location = "gym";
    else if (access.includes("outdoor")) location = "outdoor";
    else if (
      access.includes("bodyweight") ||
      access.includes("home_dumbbells")
    ) {
      location = "home";
    }
  }

  const avoidMuscles = constraints.muscles_avoid;
  const avoidSet = new Set(avoidMuscles);
  const injuries = [...new Set<JointArea>([...profileInjuries(profile), ...constraints.injuries_limitations])];
  const excludedFamilies = constraints.excluded_families;
  const lowImpact = constraints.low_impact || excludedFamilies.includes("jump");

  // Required: negation-aware phrases from the CURRENT request only.
  const requiredPhrases = [
    ...new Set([...parseRequiredExercisePhrases(currentPositive), ...constraints.must_include]),
  ];
  const adjustments: string[] = [];
  const safetyFilter: ExerciseFilter = {
    equipment,
    injuries,
    avoidGroups: avoidMuscles,
    lowImpact,
    excludedFamilies,
  };
  const requiredExercises = requiredPhrases
    .map((q) => resolveExerciseRef(q, equipment))
    .filter((ref) => ref.catalogName || /\b(?:push|pull|squat|lunge|press|curl|plank|row|bridge|climber|burpee|deadlift|bench|dip|raise|thrust|jack|crunch|sit)/.test(ref.query))
    .map((ref) => adjustRequiredForSafety(ref, {
      maxDifficulty,
      override: constraints.experience_override,
      experience,
      filter: safetyFilter,
      adjustments,
    }));
  const excludedExercises = constraints.must_exclude.map((q) => resolveExerciseRef(q, null));

  if (requestedDifficulty === "advanced" && experience === "beginner" && !constraints.experience_override) {
    adjustments.push(
      "Your profile says beginner, so the harder session stays challenging but skips elite skill moves (tell me if you've progressed and I'll update your level)."
    );
  }

  const focus = parseFocus(currentPositive).filter((f) => !focusBlockedByAvoid(f, avoidSet));
  let focusGroups = constraints.muscles_focus.filter((g) => !avoidSet.has(g));
  if (focusGroups.length === 0) {
    focusGroups = [...new Set(focus.flatMap((f) => FOCUS_GROUPS[f] ?? []))].filter((g) => !avoidSet.has(g));
  }

  return {
    equipment,
    focus,
    durationMinutes: constraints.duration_minutes ?? parseDurationMinutes(currentText),
    difficulty,
    exerciseCount: constraints.exercise_count ?? parseExerciseCount(currentText),
    requiredExercises,
    excludedExercises,
    excludedFamilies,
    location,
    varietyLevel: parseVarietyLevel(currentText),
    rawText,
    avoidMuscles,
    reduceMuscles: constraints.muscles_reduce,
    focusGroups,
    injuries,
    lowImpact,
    maxDifficulty,
    experience,
    difficultySource,
    daysPerWeek: constraints.frequency_days,
    excludedDayFocuses: constraints.days_exclude,
    adjustments,
    constraints,
  };
}

/**
 * Required exercise above the client's level or unsafe for an injury →
 * swap for a regression and explain, unless the user said they can do it.
 */
function adjustRequiredForSafety(
  ref: ResolvedExerciseRef,
  opts: {
    maxDifficulty: DifficultyTier | null;
    override: boolean;
    experience: ExperienceLevel | null;
    filter: ExerciseFilter;
    adjustments: string[];
  }
): ResolvedExerciseRef {
  if (!ref.catalogName || opts.override) return ref;
  const ex = findCatalogExercise(ref.catalogName);
  if (!ex) return ref;
  const profile = getExerciseProfile(ex);
  const tooHard = opts.maxDifficulty != null && profile.difficulty > opts.maxDifficulty;
  const injuryHit = exerciseRejection(ex, { injuries: opts.filter.injuries });
  if (!tooHard && !injuryHit) return ref;

  const tier = (opts.maxDifficulty ?? profile.difficulty) as DifficultyTier;
  const replacement = regressionFor(ex, tier, opts.filter);
  const why = injuryHit
    ? `${ex.name} puts ${injuryHit.detail.replace(/^high /, "high ")} on a joint you flagged`
    : `${ex.name} is a ${DIFFICULTY_LABEL[profile.difficulty]} exercise and you're training at ${opts.experience ?? "a lower"} level`;
  if (!replacement) {
    opts.adjustments.push(`${why}; only include it if you can do it pain-free with good form.`);
    return ref;
  }
  opts.adjustments.push(
    `${why}, so I used ${replacement.name} as a progression toward it. Say "I can do it" and I'll put ${ex.name} back.`
  );
  return {
    query: ref.query,
    catalogName: replacement.name,
    catalogId: replacement.id,
    families: [],
    equipment: replacement.equipment,
  };
}

export function detectRequirementConflicts(
  requirements: WorkoutRequirements
): RequirementConflict[] {
  const conflicts: RequirementConflict[] = [];
  const genericAliases = new Set([
    "squat",
    "squats",
    "lunge",
    "lunges",
    "deadlift",
    "deadlifts",
    "row",
    "rows",
    "press",
    "curl",
    "curls",
    "plank",
    "planks",
  ]);

  for (const req of requirements.requiredExercises) {
    const unrestrictedRef = resolveExerciseRef(req.query, null);
    const queryImpliesForbiddenEquipment =
      /\b(barbell|dumbbell|cable|machine|kettlebell|smith|sled|ez[\s-]?bar)\b/i.test(
        req.query
      );
    const isGeneric = genericAliases.has(req.query.trim().toLowerCase());

    if (unrestrictedRef.catalogName) {
      const gymEx = findCatalogExercise(unrestrictedRef.catalogName);
      if (
        gymEx &&
        !exerciseAllowedByConstraint(gymEx, requirements.equipment)
      ) {
        const remappedOk =
          !!req.catalogName &&
          !!findCatalogExercise(req.catalogName, {
            equipment: requirements.equipment,
          });

        // Generic names (e.g. "squats") may remap to an allowed variant — OK.
        // Explicit "barbell squat" / non-generic "leg press" under no-equipment → conflict.
        if (queryImpliesForbiddenEquipment || !isGeneric || !remappedOk) {
          const reason =
            equipmentViolationReason(gymEx, requirements.equipment) ??
            `needs ${gymEx.equipment.join(", ") || "specialized equipment"}`;
          conflicts.push({
            code: "required_vs_equipment",
            hard: true,
            message: `"${gymEx.name}" ${reason}, which conflicts with your equipment restriction (${requirements.equipment.label.replace(/_/g, " ")}). I can either keep the equipment restriction or include this exercise and allow that equipment.`,
            options: [
              `Keep equipment restriction — skip ${gymEx.name}`,
              `Allow the equipment needed for ${gymEx.name}`,
            ],
          });
          continue;
        }
      }
    }

    if (!req.catalogName) {
      if (
        /\b(push|pull|squat|lunge|press|curl|plank|row|bridge|climber|burpee|deadlift|bench)\b/i.test(
          req.query
        )
      ) {
        conflicts.push({
          code: "required_unresolved",
          hard: true,
          message: `I couldn't match "${req.query}" to an allowed exercise in the library for your equipment. Can you use a more common name, or relax the equipment rule?`,
          options: [
            "Rephrase the exercise name",
            "Relax equipment restrictions",
            "Continue without requiring that exact exercise",
          ],
        });
      }
      continue;
    }

    if (
      req.families.some((f) => requirements.excludedFamilies.includes(f)) ||
      exerciseMatchesAnyFamily(req.catalogName, requirements.excludedFamilies)
    ) {
      const family = EXERCISE_FAMILIES.find((f) =>
        req.families.includes(f.id)
      );
      conflicts.push({
        code: "required_vs_family_exclude",
        hard: true,
        message: `You asked to include "${req.query}" but also to avoid ${family?.label ?? "that movement family"}. Those requirements conflict.`,
        options: [
          `Include ${req.catalogName ?? req.query}`,
          `Keep excluding ${family?.label ?? "that family"}`,
        ],
      });
    }

    const reqEx = findCatalogExercise(req.catalogName);
    if (reqEx && requirements.avoidMuscles.length > 0) {
      const rejection = exerciseRejection(reqEx, { avoidGroups: requirements.avoidMuscles });
      if (rejection) {
        const avoided = describeMuscleGroups(requirements.avoidMuscles);
        conflicts.push({
          code: "required_vs_avoided_muscle",
          hard: true,
          message: `"${reqEx.name}" mainly trains ${rejection.detail}, but you asked me not to train ${avoided}. Which should I follow?`,
          options: [`Include ${reqEx.name} anyway`, `Keep ${avoided} out and skip ${reqEx.name}`],
        });
      }
    }

    for (const excl of requirements.excludedExercises) {
      if (!excl.catalogName || !req.catalogName) continue;
      if (
        excl.catalogName.toLowerCase() === req.catalogName.toLowerCase() ||
        excl.query === req.query
      ) {
        conflicts.push({
          code: "required_vs_excluded",
          hard: true,
          message: `You asked both to include and to exclude "${req.query}". Which should I follow?`,
          options: [`Include ${req.query}`, `Exclude ${req.query}`],
        });
      }
    }
  }

  return conflicts;
}

/** Throw if any hard conflicts exist — callers should surface the message to the user. */
export function assertNoRequirementConflicts(
  requirements: WorkoutRequirements
): void {
  const conflicts = detectRequirementConflicts(requirements);
  if (conflicts.length > 0) {
    throw new WorkoutRequirementConflictError(conflicts, requirements);
  }
}

/** Prompt block describing structured hard/soft requirements for the LLM. */
export function buildRequirementsPromptBlock(
  requirements: WorkoutRequirements
): string {
  const lines: string[] = ["STRUCTURED REQUIREMENTS (authoritative — do not violate hard constraints):"];

  lines.push(`- Equipment: ${requirements.equipment.promptRule}`);

  if (requirements.location) {
    lines.push(
      `- Location: ${requirements.location}. Note: "home" does NOT automatically mean no equipment — follow the equipment rule above.`
    );
  }

  if (requirements.focus.length > 0) {
    lines.push(`- Focus / workout type: ${requirements.focus.join(", ")}.`);
  }

  if (requirements.durationMinutes != null) {
    lines.push(
      `- HARD: Target session duration ≈ ${requirements.durationMinutes} minutes (volume must fit — fewer exercises / shorter rest if needed).`
    );
  }

  if (requirements.difficulty) {
    lines.push(
      `- Difficulty: ${requirements.difficulty} (select exercise complexity, sets, and reps accordingly).`
    );
  }

  if (requirements.exerciseCount != null) {
    lines.push(
      `- HARD: Include exactly ${requirements.exerciseCount} exercises per session.`
    );
  }

  if (requirements.requiredExercises.length > 0) {
    const names = requirements.requiredExercises
      .map((r) => r.catalogName ?? r.query)
      .join(", ");
    lines.push(`- HARD: MUST include these exercises: ${names}.`);
  }

  if (requirements.excludedFamilies.length > 0) {
    const labels = requirements.excludedFamilies
      .map((id) => EXERCISE_FAMILIES.find((f) => f.id === id)?.label ?? id)
      .join(", ");
    lines.push(`- HARD: Do NOT include any ${labels}.`);
  }

  if (requirements.excludedExercises.length > 0) {
    const names = requirements.excludedExercises
      .map((r) => r.catalogName ?? r.query)
      .join(", ");
    lines.push(`- HARD: Do NOT include: ${names}.`);
  }

  if (requirements.avoidMuscles.length > 0) {
    lines.push(
      `- HARD: Do NOT train ${describeMuscleGroups(requirements.avoidMuscles)} — no exercise may target them as a primary muscle (and no replacement day for them).`
    );
  }
  if (requirements.reduceMuscles.length > 0) {
    lines.push(`- Reduce volume for: ${describeMuscleGroups(requirements.reduceMuscles)}.`);
  }
  if (requirements.focusGroups.length > 0) {
    lines.push(
      `- Focus bias: most working sets should target ${describeMuscleGroups(requirements.focusGroups)} (pick exercises whose PRIMARY muscles match).`
    );
  }
  if (requirements.injuries.length > 0) {
    lines.push(
      `- HARD (safety): protect ${requirements.injuries.join(", ")} — avoid high-stress moves for those joints; prefer controlled, pain-free ranges. Do not diagnose; suggest a physio/doctor if pain persists.`
    );
  }
  if (requirements.lowImpact) {
    lines.push("- HARD: Low impact — no jumping, hopping, bounding, or burpees.");
  }
  if (requirements.maxDifficulty != null) {
    lines.push(
      `- HARD: Exercise complexity at most "${DIFFICULTY_LABEL[requirements.maxDifficulty]}" level.`
    );
  }
  if (requirements.experience) {
    lines.push(`- Programming for a ${requirements.experience}: ${EXPERIENCE_PROGRAMMING[requirements.experience]}`);
  }
  if (requirements.excludedDayFocuses.length > 0) {
    lines.push(
      `- HARD: Do not schedule these day types: ${requirements.excludedDayFocuses.join(", ").replace(/_/g, " ")}.`
    );
  }
  if (requirements.adjustments.length > 0) {
    lines.push(`- Adjustments already made (mention briefly in coach_notes): ${requirements.adjustments.join(" ")}`);
  }

  if (requirements.varietyLevel === "high") {
    lines.push(
      "- Prefer high variety: choose less common catalog exercises that still fit the constraints."
    );
  }

  return lines.join("\n");
}

const EXPERIENCE_PROGRAMMING: Record<ExperienceLevel, string> = {
  beginner:
    "simple, stable, low-skill movements; 4–6 exercises; 2–3 sets of 8–15 reps; 60–90s rest; clear technique cues; no complex/skill lifts.",
  intermediate:
    "compound lifts first, then accessories; 5–7 exercises; 3–4 sets of 6–12 reps; progressive overload; sensible weekly volume.",
  advanced:
    "higher volume/intensity with purposeful technique (tempo, pauses, supersets where useful); 6–8 exercises; 3–5 sets across rep ranges; advanced variations only where they add value.",
};

export function formatConflictToolResult(
  error: WorkoutRequirementConflictError
): string {
  const parts = error.conflicts.map((c, i) => {
    const opts = c.options.map((o, j) => `  ${j + 1}. ${o}`).join("\n");
    return `${i + 1}. ${c.message}\nOptions:\n${opts}`;
  });
  return `I can't generate that workout yet because the requirements conflict:\n\n${parts.join("\n\n")}\n\nTell me which option you prefer and I'll continue. Do NOT invent a workout that silently ignores either requirement.`;
}
