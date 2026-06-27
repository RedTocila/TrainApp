import { formatElapsedClock } from "@/lib/workout-duration";

export function formatLoggedSetLine(set: {
  reps: number | null;
  weight_kg: number | null;
}): string | null {
  if (set.reps == null && set.weight_kg == null) return null;
  const reps = set.reps != null ? `${set.reps}` : "—";
  const weight = set.weight_kg != null ? `${set.weight_kg} kg` : "—";
  return `${reps} × ${weight}`;
}

export function formatSessionDuration(
  startedAt: string | null,
  completedAt: string | null
): string | null {
  if (!startedAt || !completedAt) return null;
  const seconds = Math.max(
    0,
    Math.floor(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
    )
  );
  return formatElapsedClock(seconds);
}
