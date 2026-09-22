/**
 * Structured workout requirements extracted from user text + profile intake.
 * Hard constraints are validated in code; the LLM receives them as authoritative rules.
 */

import {
  exerciseAllowedByConstraint,
  resolveEquipmentConstraint,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import {
  exerciseMatchesAnyFamily,
  parseExcludedExercisePhrases,
  parseExcludedFamiliesFromText,
  parseRequiredExercisePhrases,
  resolveExerciseRef,
  type ExerciseFamilyId,
  type ResolvedExerciseRef,
  EXERCISE_FAMILIES,
} from "@/lib/ai/exercise-semantic-match";
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
};

export type RequirementConflict = {
  code:
    | "required_vs_equipment"
    | "required_vs_excluded"
    | "required_unresolved"
    | "required_vs_family_exclude";
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

/**
 * Build structured requirements from profile intake + free-text request.
 * Explicit request text wins over intake for equipment and focus.
 */
export function resolveWorkoutRequirements(
  profile: Profile,
  preferences?: string | null
): WorkoutRequirements {
  const rawText = preferences?.trim() ?? "";
  const equipment = resolveEquipmentConstraint(profile, preferences);
  const responses = profileToResponses(profile);

  let difficulty = parseDifficulty(rawText);
  if (!difficulty) {
    switch (responses.training_experience) {
      case "beginner":
        difficulty = "beginner";
        break;
      case "advanced":
        difficulty = "advanced";
        break;
      case "intermediate":
        difficulty = "intermediate";
        break;
      default:
        difficulty = null;
    }
  }

  let location = parseLocation(rawText);
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

  const requiredPhrases = parseRequiredExercisePhrases(rawText);
  const excludedPhrases = parseExcludedExercisePhrases(rawText);
  const excludedFamilies = parseExcludedFamiliesFromText(rawText);

  const requiredExercises = requiredPhrases.map((q) =>
    resolveExerciseRef(q, equipment)
  );
  const excludedExercises = excludedPhrases.map((q) =>
    resolveExerciseRef(q, null)
  );

  return {
    equipment,
    focus: parseFocus(rawText),
    durationMinutes: parseDurationMinutes(rawText),
    difficulty,
    exerciseCount: parseExerciseCount(rawText),
    requiredExercises,
    excludedExercises,
    excludedFamilies,
    location,
    varietyLevel: parseVarietyLevel(rawText),
    rawText,
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
          const eq = gymEx.equipment.join(", ") || "specialized equipment";
          conflicts.push({
            code: "required_vs_equipment",
            hard: true,
            message: `"${gymEx.name}" requires ${eq}, which conflicts with your equipment restriction (${requirements.equipment.label.replace(/_/g, " ")}). I can either keep the equipment restriction or include this exercise and allow that equipment.`,
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

  if (requirements.varietyLevel === "high") {
    lines.push(
      "- Prefer high variety: choose less common catalog exercises that still fit the constraints."
    );
  }

  return lines.join("\n");
}

export function formatConflictToolResult(
  error: WorkoutRequirementConflictError
): string {
  const parts = error.conflicts.map((c, i) => {
    const opts = c.options.map((o, j) => `  ${j + 1}. ${o}`).join("\n");
    return `${i + 1}. ${c.message}\nOptions:\n${opts}`;
  });
  return `I can't generate that workout yet because the requirements conflict:\n\n${parts.join("\n\n")}\n\nTell me which option you prefer and I'll continue. Do NOT invent a workout that silently ignores either requirement.`;
}
