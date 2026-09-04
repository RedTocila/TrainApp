/** Legacy cleanup only — active timer is in-memory and resets when you leave. */

export function clearWorkoutTimerState(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`workout-timer-v2-${sessionId}`);
    sessionStorage.removeItem(`workout-timer-anchor-${sessionId}`);
  } catch {
    /* ignore */
  }
}
