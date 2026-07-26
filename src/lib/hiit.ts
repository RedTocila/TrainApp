export type WorkoutPlanKind = "strength" | "hiit" | "warmup" | "stretch";

/** Warmup / stretching — can sit on a day next to a main workout. */
export function isExtraWorkoutKind(
  kind: string | null | undefined
): boolean {
  return kind === "warmup" || kind === "stretch";
}

export function isMainWorkoutKind(kind: string | null | undefined): boolean {
  return !isExtraWorkoutKind(kind);
}

/** True when every main (strength/HIIT) session is done — extras do not block. */
export function areMainWorkoutsComplete<
  T extends { planKind?: string | null; taskId: string },
>(workouts: T[], isCompleted: (taskId: string) => boolean): boolean {
  const mains = workouts.filter((w) => isMainWorkoutKind(w.planKind));
  if (mains.length === 0) return false;
  return mains.every((w) => isCompleted(w.taskId));
}

/** Main done but warm-up and/or stretching still open. */
export function hasIncompleteWorkoutExtras<
  T extends { planKind?: string | null; taskId: string },
>(workouts: T[], isCompleted: (taskId: string) => boolean): boolean {
  if (!areMainWorkoutsComplete(workouts, isCompleted)) return false;
  return workouts.some(
    (w) => isExtraWorkoutKind(w.planKind) && !isCompleted(w.taskId)
  );
}

/** Display order on a calendar day: warm-up → main → stretching. */
export function sessionKindSortOrder(kind: string | null | undefined): number {
  if (kind === "warmup") return 0;
  if (kind === "stretch") return 2;
  return 1;
}

export function sortWorkoutsBySessionOrder<
  T extends { planKind?: string | null },
>(workouts: T[]): T[] {
  return [...workouts].sort(
    (a, b) =>
      sessionKindSortOrder(a.planKind) - sessionKindSortOrder(b.planKind)
  );
}

export function normalizeWorkoutPlanKind(
  kind: string | null | undefined
): WorkoutPlanKind {
  if (kind === "hiit" || kind === "warmup" || kind === "stretch") return kind;
  return "strength";
}

export interface HiitExerciseConfig {
  name: string;
  work_seconds: number;
  rest_seconds: number;
  notes?: string | null;
  video_url?: string | null;
  image_url?: string | null;
}

export interface HiitConfig {
  prepare_seconds: number;
  rounds: number;
  round_rest_seconds: number;
  cycles: number;
  cycle_rest_seconds: number;
  exercises: HiitExerciseConfig[];
}

export type HiitPhaseType =
  | "prepare"
  | "work"
  | "rest"
  | "round_rest"
  | "cycle_rest"
  | "done";

export interface HiitPhase {
  type: HiitPhaseType;
  durationSeconds: number;
  label: string;
  exerciseName: string | null;
  nextExerciseName: string | null;
  exerciseIndex: number;
  round: number;
  cycle: number;
  totalRounds: number;
  totalCycles: number;
}

export const DEFAULT_HIIT_CONFIG: HiitConfig = {
  prepare_seconds: 10,
  rounds: 3,
  round_rest_seconds: 90,
  cycles: 1,
  cycle_rest_seconds: 120,
  exercises: [
    { name: "", work_seconds: 40, rest_seconds: 20 },
    { name: "", work_seconds: 40, rest_seconds: 20 },
    { name: "", work_seconds: 40, rest_seconds: 20 },
  ],
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeHiitConfig(raw: unknown): HiitConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const config = raw as Partial<HiitConfig>;
  const exercises = Array.isArray(config.exercises)
    ? config.exercises.flatMap((ex): HiitExerciseConfig[] => {
        if (!ex || typeof ex !== "object") return [];
        const name = typeof ex.name === "string" ? ex.name.trim() : "";
        if (!name) return [];
        return [
          {
            name,
            work_seconds: clampInt(ex.work_seconds, 5, 600, 40),
            rest_seconds: clampInt(ex.rest_seconds, 0, 600, 20),
            notes: typeof ex.notes === "string" ? ex.notes : null,
            video_url: typeof ex.video_url === "string" ? ex.video_url : null,
            image_url: typeof ex.image_url === "string" ? ex.image_url : null,
          },
        ];
      })
    : [];

  if (exercises.length === 0) return null;

  return {
    prepare_seconds: clampInt(config.prepare_seconds, 0, 60, 10),
    rounds: clampInt(config.rounds, 1, 50, 3),
    round_rest_seconds: clampInt(config.round_rest_seconds, 0, 600, 90),
    cycles: clampInt(config.cycles, 1, 20, 1),
    cycle_rest_seconds: clampInt(config.cycle_rest_seconds, 0, 900, 120),
    exercises,
  };
}

export function parseHiitConfig(raw: unknown): HiitConfig | null {
  return normalizeHiitConfig(raw);
}

export function isHiitPlan(
  plan: { kind?: string | null; hiit_config?: unknown } | null | undefined
): boolean {
  return plan?.kind === "hiit";
}

/** HIIT, warm-up, and stretching sessions that run on the interval timer. */
export function isIntervalPlan(
  plan: { kind?: string | null; hiit_config?: unknown } | null | undefined
): boolean {
  if (!plan) return false;
  if (plan.kind === "hiit") return true;
  if (plan.kind === "warmup" || plan.kind === "stretch") {
    return normalizeHiitConfig(plan.hiit_config) != null;
  }
  return false;
}

export function estimateHiitDurationSeconds(config: HiitConfig): number {
  const { prepare_seconds, rounds, round_rest_seconds, cycles, cycle_rest_seconds, exercises } =
    config;
  if (exercises.length === 0) return prepare_seconds;

  let perRound = 0;
  exercises.forEach((ex, i) => {
    perRound += ex.work_seconds;
    if (i < exercises.length - 1) perRound += ex.rest_seconds;
  });

  const roundRestTotal = Math.max(0, rounds - 1) * round_rest_seconds;
  const perCycle = rounds * perRound + roundRestTotal;
  const cycleRestTotal = Math.max(0, cycles - 1) * cycle_rest_seconds;
  return prepare_seconds + cycles * perCycle + cycleRestTotal;
}

export function formatHiitClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildHiitPhases(config: HiitConfig): HiitPhase[] {
  const phases: HiitPhase[] = [];
  const { exercises, rounds, cycles } = config;
  if (exercises.length === 0) return phases;

  if (config.prepare_seconds > 0) {
    phases.push({
      type: "prepare",
      durationSeconds: config.prepare_seconds,
      label: "Prepare",
      exerciseName: exercises[0]?.name ?? null,
      nextExerciseName: exercises[0]?.name ?? null,
      exerciseIndex: 0,
      round: 1,
      cycle: 1,
      totalRounds: rounds,
      totalCycles: cycles,
    });
  }

  for (let cycle = 1; cycle <= cycles; cycle++) {
    for (let round = 1; round <= rounds; round++) {
      exercises.forEach((ex, exerciseIndex) => {
        const nextInRound = exercises[exerciseIndex + 1];
        const isLastExercise = exerciseIndex === exercises.length - 1;
        const isLastRound = round === rounds;
        const isLastCycle = cycle === cycles;

        phases.push({
          type: "work",
          durationSeconds: ex.work_seconds,
          label: "Work",
          exerciseName: ex.name,
          nextExerciseName: nextInRound?.name ?? null,
          exerciseIndex,
          round,
          cycle,
          totalRounds: rounds,
          totalCycles: cycles,
        });

        if (!isLastExercise && ex.rest_seconds > 0) {
          phases.push({
            type: "rest",
            durationSeconds: ex.rest_seconds,
            label: "Rest",
            exerciseName: ex.name,
            nextExerciseName: nextInRound?.name ?? null,
            exerciseIndex,
            round,
            cycle,
            totalRounds: rounds,
            totalCycles: cycles,
          });
        } else if (isLastExercise && !isLastRound && config.round_rest_seconds > 0) {
          const nextExercise = exercises[0]?.name ?? null;
          phases.push({
            type: "round_rest",
            durationSeconds: config.round_rest_seconds,
            label: "Round rest",
            exerciseName: null,
            nextExerciseName: nextExercise,
            exerciseIndex,
            round,
            cycle,
            totalRounds: rounds,
            totalCycles: cycles,
          });
        } else if (
          isLastExercise &&
          isLastRound &&
          !isLastCycle &&
          config.cycle_rest_seconds > 0
        ) {
          phases.push({
            type: "cycle_rest",
            durationSeconds: config.cycle_rest_seconds,
            label: "Cycle rest",
            exerciseName: null,
            nextExerciseName: exercises[0]?.name ?? null,
            exerciseIndex,
            round,
            cycle,
            totalRounds: rounds,
            totalCycles: cycles,
          });
        }
      });
    }
  }

  phases.push({
    type: "done",
    durationSeconds: 0,
    label: "Done",
    exerciseName: null,
    nextExerciseName: null,
    exerciseIndex: Math.max(0, exercises.length - 1),
    round: rounds,
    cycle: cycles,
    totalRounds: rounds,
    totalCycles: cycles,
  });

  return phases;
}

export function hiitSummaryLabel(config: HiitConfig): string {
  const mins = Math.max(1, Math.round(estimateHiitDurationSeconds(config) / 60));
  const parts = [
    `${config.exercises.length} moves`,
    `${config.rounds} rounds`,
  ];
  if (config.cycles > 1) parts.push(`${config.cycles} cycles`);
  parts.push(`~${mins} min`);
  return parts.join(" · ");
}
