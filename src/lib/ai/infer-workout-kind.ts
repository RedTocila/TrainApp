import type { WorkoutPlanKind } from "@/lib/hiit";

/**
 * Prefer an explicit kind from the UI/tool.
 * Otherwise detect HIIT vs fitness from what the user wrote (EN + AL); default strength.
 */
export function inferAiWorkoutKind(
  preferences?: string,
  explicit?: WorkoutPlanKind | null
): WorkoutPlanKind {
  if (explicit === "hiit" || explicit === "strength") return explicit;
  const text = (preferences ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!text.trim()) return "strength";

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
