const STORAGE_PREFIX = "workout-timer-anchor-";

export function getWorkoutTimerAnchor(sessionId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setWorkoutTimerAnchor(sessionId: string, anchorMs: number) {
  sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, String(anchorMs));
}

export function clearWorkoutTimerAnchor(sessionId: string) {
  sessionStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
}
