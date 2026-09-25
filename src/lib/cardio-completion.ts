/** Cardio may finish early within this fraction of the planned duration. */
export const CARDIO_COMPLETION_TOLERANCE = 0.2;

/** When no planned duration is set, require at least this long before complete. */
export const CARDIO_UNPLANNED_MIN_SECONDS = 60;

/** Minimum elapsed seconds required to count as complete (80% of plan). */
export function minCardioSecondsForComplete(
  plannedMinutes: number | null | undefined
): number {
  if (plannedMinutes == null || plannedMinutes <= 0) {
    return CARDIO_UNPLANNED_MIN_SECONDS;
  }
  return Math.ceil(plannedMinutes * 60 * (1 - CARDIO_COMPLETION_TOLERANCE));
}

export function isCardioDurationComplete(
  elapsedSeconds: number,
  plannedMinutes: number | null | undefined
): boolean {
  if (elapsedSeconds <= 0) return false;
  return elapsedSeconds >= minCardioSecondsForComplete(plannedMinutes);
}

export function formatCardioElapsedMinutes(elapsedSeconds: number): number {
  return Math.max(1, Math.round(elapsedSeconds / 60));
}
