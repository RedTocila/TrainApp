import type { WorkoutPlanKind } from "@/lib/hiit";
import { isExtraWorkoutKind } from "@/lib/hiit";

/**
 * Prefer an explicit kind from the UI/tool.
 * Otherwise detect HIIT vs fitness / warmup / stretch from what the user wrote.
 * Default strength.
 */
export function inferAiWorkoutKind(
  preferences?: string,
  explicit?: WorkoutPlanKind | null
): WorkoutPlanKind {
  if (
    explicit === "hiit" ||
    explicit === "strength" ||
    explicit === "warmup" ||
    explicit === "stretch"
  ) {
    return explicit;
  }
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return "strength";

  if (
    /\b(warm[\s-]?up|warmup|nxehje|ngrohje)\b/i.test(text) &&
    !/\b(stretch|stretching|mobility|flexibility|shtrirje)\b/i.test(text) &&
    !/\b(workout|stervitje|training|main|full)\b/i.test(text)
  ) {
    return "warmup";
  }
  if (
    /\b(stretch|stretching|mobility|flexibility|cool[\s-]?down|shtrirje|mobilitet)\b/i.test(
      text
    ) &&
    !/\b(workout|stervitje|training|main|full|upper|lower|push|pull)\b/i.test(text)
  ) {
    return "stretch";
  }

  const wantsHiit =
    /\b(hiit|high[\s-]?intensity(\s+interval)?(\s+training)?|tabata|interval\s*training|timed\s*intervals?|circuit\s*timer|intervale|intervalesh|kohemates|me\s+kohe|intensitet\s+i\s+larte)\b/i.test(
      text
    ) || /\b(stervitje|workout|session|plan)\s+hiit\b/i.test(text);
  if (!wantsHiit) return "strength";

  const wantsTraditional =
    /\b(traditional|strength\s*training|hypertrophy|bodybuilding|powerlifting|sets?\s*(and|&|\/)\s*reps?|fitness(\s+workout)?|normal\s+workout|tradicional|hipertrofi|seri\s*(dhe|&|\/)\s*perseritje|sete\s*(dhe|&|\/)\s*reps?)\b/i.test(
      text
    ) && !/\b(hiit|tabata)\b/i.test(text);
  if (wantsTraditional) return "strength";

  return "hiit";
}

/** Main session only — warm-up / stretch keywords do not override the main workout type. */
export function inferAiMainWorkoutKind(
  preferences?: string
): "strength" | "hiit" {
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return "strength";

  const wantsHiit =
    /\b(hiit|high[\s-]?intensity(\s+interval)?(\s+training)?|tabata|interval\s*training|timed\s*intervals?|circuit\s*timer|intervale|intervalesh)\b/i.test(
      text
    );
  if (!wantsHiit) return "strength";

  const wantsTraditional =
    /\b(traditional|strength\s*training|hypertrophy|sets?\s*(and|&|\/)\s*reps?|fitness(\s+workout)?)\b/i.test(
      text
    ) && !/\b(hiit|tabata)\b/i.test(text);
  return wantsTraditional ? "strength" : "hiit";
}

export { isExtraWorkoutKind };
