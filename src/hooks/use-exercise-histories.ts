"use client";

import { useEffect, useMemo, useState } from "react";
import { getLatestExerciseHistoriesByNames } from "@/lib/actions/workout-sessions";
import { exerciseHistoryLookupKey } from "@/lib/exercise-history-format";
import type { ExerciseHistoryEntry } from "@/lib/types";

/**
 * Loads the most recent completed sets for each exercise name.
 * Map keys are lowercase trimmed names (`exerciseHistoryLookupKey`).
 */
export function useExerciseHistories(
  names: string[]
): Record<string, ExerciseHistoryEntry | null> {
  const [histories, setHistories] = useState<
    Record<string, ExerciseHistoryEntry | null>
  >({});

  const stableKey = useMemo(() => {
    const unique = [
      ...new Set(
        names
          .map((name) => exerciseHistoryLookupKey(name))
          .filter((name) => name.length > 0)
      ),
    ].sort();
    return unique.join("\0");
  }, [names]);

  useEffect(() => {
    if (!stableKey) {
      setHistories({});
      return;
    }

    let cancelled = false;
    const uniqueNames = stableKey.split("\0");

    void getLatestExerciseHistoriesByNames(uniqueNames).then((result) => {
      if (!cancelled) setHistories(result);
    });

    return () => {
      cancelled = true;
    };
  }, [stableKey]);

  return histories;
}

export function lookupExerciseHistory(
  histories: Record<string, ExerciseHistoryEntry | null>,
  name: string
): ExerciseHistoryEntry | null {
  return histories[exerciseHistoryLookupKey(name)] ?? null;
}
