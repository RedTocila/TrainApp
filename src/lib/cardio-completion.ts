/** Cardio may finish early within this fraction of the planned duration. */
export const CARDIO_COMPLETION_TOLERANCE = 0.2;

/** Minimum elapsed seconds required to count as complete (80% of plan). */
export function minCardioSecondsForComplete(
  plannedMinutes: number | null | undefined
): number | null {
  if (plannedMinutes == null || plannedMinutes <= 0) return null;
  return Math.ceil(plannedMinutes * 60 * (1 - CARDIO_COMPLETION_TOLERANCE));
}

export function isCardioDurationComplete(
  elapsedSeconds: number,
  plannedMinutes: number | null | undefined
): boolean {
  if (elapsedSeconds <= 0) return false;
  const minimum = minCardioSecondsForComplete(plannedMinutes);
  if (minimum == null) return true;
  return elapsedSeconds >= minimum;
}

export function formatCardioElapsedMinutes(elapsedSeconds: number): number {
  return Math.max(1, Math.round(elapsedSeconds / 60));
}
