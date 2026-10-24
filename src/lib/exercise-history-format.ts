import { formatWeightWithUnitFromKg } from "@/lib/body-units";
import type { ExerciseHistoryEntry } from "@/lib/types";

const FALLBACK_NEVER_TRIED = "Never tried this one before";

/** Compact "10 × 40 kg" summary. Pass `setNumber` to keep only that set. */
export function formatExerciseHistoryParts(
  history: ExerciseHistoryEntry | null | undefined,
  setNumber?: number
): string | null {
  if (!history?.sets.length) return null;
  const logged = history.sets.filter(
    (s) => s.reps != null || s.weight_kg != null
  );
  const chosen =
    setNumber == null
      ? logged
      : logged.filter((set, index) =>
          set.set_number != null ? set.set_number === setNumber : index + 1 === setNumber
        );
  const parts = chosen
    .map((s) => {
      const reps = s.reps != null ? `${s.reps}` : "—";
      const weight =
        s.weight_kg != null ? formatWeightWithUnitFromKg(Number(s.weight_kg)) : "—";
      return `${reps} × ${weight}`;
    });
  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatExerciseHistoryLabel(
  history: ExerciseHistoryEntry | null | undefined,
  lastLabel: ((parts: string) => string) | undefined,
  emptyLabel?: string | null,
  setNumber?: number
): string {
  const parts = formatExerciseHistoryParts(history, setNumber);
  if (parts) {
    return typeof lastLabel === "function"
      ? lastLabel(parts)
      : `Last: ${parts}`;
  }
  if (emptyLabel === "") return "";
  return emptyLabel?.trim() || FALLBACK_NEVER_TRIED;
}

export function exerciseHistoryLookupKey(name: string): string {
  return name.trim().toLowerCase();
}
