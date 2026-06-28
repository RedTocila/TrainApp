/** Acceptable deviation below the daily water goal (±20% band). */
export const DAILY_WATER_TOLERANCE_PCT = 0.2;

const MIN_WATER_TOLERANCE_ML = 250;

export function waterToleranceBand(
  goalMl: number,
  pct = DAILY_WATER_TOLERANCE_PCT
): { min: number; max: number } {
  if (goalMl <= 0) return { min: 0, max: 0 };
  const delta = Math.max(Math.round(goalMl * pct), MIN_WATER_TOLERANCE_ML);
  return {
    min: Math.max(0, goalMl - delta),
    max: goalMl + delta,
  };
}

/** True when intake is within the daily water tolerance band. */
export function waterWithinDailyTarget(actualMl: number, goalMl: number): boolean {
  if (goalMl <= 0) return true;
  const { min, max } = waterToleranceBand(goalMl);
  return actualMl >= min && actualMl <= max;
}

/** True when enough water was logged (lower bound of tolerance band). */
export function waterMetDailyMinimum(actualMl: number, goalMl: number): boolean {
  if (goalMl <= 0) return true;
  const { min } = waterToleranceBand(goalMl);
  return actualMl >= min;
}

/** True when intake is above the upper tolerance band. */
export function waterExceededDailyUpperLimit(actualMl: number, goalMl: number): boolean {
  if (goalMl <= 0) return false;
  const { max } = waterToleranceBand(goalMl);
  return actualMl > max;
}

/** Milliliters still needed to reach the minimum acceptable intake. */
export function waterRemainingToMinimum(actualMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0;
  const { min } = waterToleranceBand(goalMl);
  return Math.max(0, min - actualMl);
}
