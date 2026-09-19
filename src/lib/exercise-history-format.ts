import {
  formatWeightWithUnitFromKg,
  type UnitSystem,
} from "@/lib/body-units";
import type { ExerciseHistoryEntry } from "@/lib/types";

const FALLBACK_NEVER_TRIED = "Never tried this one before";

/** Compact "10 × 40 kg, 8 × 40 kg" style summary of the last logged sets. */
export function formatExerciseHistoryParts(
  history: ExerciseHistoryEntry | null | undefined,
  unitSystem: UnitSystem
): string | null {
  if (!history?.sets.length) return null;
  const parts = history.sets
    .filter((s) => s.reps != null || s.weight_kg != null)
    .map((s) => {
      const reps = s.reps != null ? `${s.reps}` : "—";
      const weight =
        s.weight_kg != null
          ? formatWeightWithUnitFromKg(Number(s.weight_kg), unitSystem)
          : "—";
      return `${reps} × ${weight}`;
    });
  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatExerciseHistoryLabel(
  history: ExerciseHistoryEntry | null | undefined,
  lastLabel: ((parts: string) => string) | undefined,
  unitSystem: UnitSystem,
  emptyLabel?: string | null
): string {
  const parts = formatExerciseHistoryParts(history, unitSystem);
  if (parts) {
    return typeof lastLabel === "function"
      ? lastLabel(parts)
      : `Last: ${parts}`;
  }
  return emptyLabel?.trim() || FALLBACK_NEVER_TRIED;
}

export function exerciseHistoryLookupKey(name: string): string {
  return name.trim().toLowerCase();
}
