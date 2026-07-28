/** Minimal trained-day shape used by the quality radar. */
export interface WorkoutQualitySource {
  kind: "trained" | "rest" | "skipped";
  totalReps: number;
  avgWeightKg: number | null;
  volumeKg: number;
  durationSec: number;
  workSec: number;
  restSec: number;
  isInterval: boolean;
}

/** 0–100 axes for the workout quality radar (recent trained days). */
export interface WorkoutQualityProfile {
  reps: number;
  weight: number;
  rest: number;
  duration: number;
  intensity: number;
}

function clampScore01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeWorkoutQualityProfile(
  points: WorkoutQualitySource[]
): WorkoutQualityProfile {
  const trained = points.filter((p) => p.kind === "trained").slice(-14);
  if (trained.length === 0) {
    return { reps: 0, weight: 0, rest: 0, duration: 0, intensity: 0 };
  }

  const totalReps = trained.reduce((sum, p) => sum + p.totalReps, 0);
  const avgReps = totalReps / trained.length;
  const weightDays = trained.filter(
    (p) => p.avgWeightKg != null && p.avgWeightKg > 0
  );
  const avgWeight =
    weightDays.length > 0
      ? weightDays.reduce((sum, p) => sum + (p.avgWeightKg ?? 0), 0) /
        weightDays.length
      : 0;
  const totalWork = trained.reduce((sum, p) => sum + p.workSec, 0);
  const totalRest = trained.reduce((sum, p) => sum + p.restSec, 0);
  const avgDuration =
    trained.reduce((sum, p) => sum + p.durationSec, 0) / trained.length;
  const density =
    totalWork + totalRest > 0 ? totalWork / (totalWork + totalRest) : 0;
  const intervalShare =
    trained.filter((p) => p.isInterval).length / trained.length;
  const volumeHint =
    trained.reduce((sum, p) => sum + p.volumeKg, 0) / trained.length;

  const intensityFromDensity = density * 100;
  const intensityFromPace =
    avgDuration > 0
      ? Math.min(100, ((totalWork / trained.length) / avgDuration) * 140)
      : 0;
  const intensityFromVolume =
    avgDuration > 0 ? Math.min(100, volumeHint / (avgDuration / 60) / 8) : 0;

  return {
    reps: clampScore01((avgReps / 80) * 100),
    weight: clampScore01((avgWeight / 60) * 100),
    rest: clampScore01(density > 0 ? density * 100 : intervalShare * 55),
    duration: clampScore01((avgDuration / (45 * 60)) * 100),
    intensity: clampScore01(
      Math.max(
        intensityFromDensity * (0.45 + intervalShare * 0.55),
        intensityFromPace,
        intensityFromVolume,
        intervalShare * 70
      )
    ),
  };
}
