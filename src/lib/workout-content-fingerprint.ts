import type { HiitConfig } from "@/lib/hiit";
import { normalizeHiitConfig } from "@/lib/hiit";

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable signature for interval sessions (warmup / stretch / HIIT). */
export function fingerprintHiitConfig(
  kind: string,
  config: HiitConfig | null | undefined
): string | null {
  const normalized = normalizeHiitConfig(config);
  if (!normalized?.exercises.length) return null;
  const exercises = normalized.exercises
    .map(
      (ex) =>
        `${normName(ex.name)}:${ex.work_seconds}:${ex.rest_seconds}`
    )
    .join("|");
  return [
    kind,
    normalized.rounds,
    normalized.cycles,
    normalized.prepare_seconds,
    normalized.round_rest_seconds,
    normalized.cycle_rest_seconds,
    exercises,
  ].join("::");
}

export function fingerprintHiitPlan(
  kind: string,
  title: string,
  config: HiitConfig | null | undefined
): string | null {
  const body = fingerprintHiitConfig(kind, config);
  if (!body) return null;
  return `${normName(title)}##${body}`;
}

type StrengthExerciseLike = {
  name?: string | null;
  sets?: number | null;
  reps?: string | number | null;
  rest_seconds?: number | null;
};

/** Stable signature for sets×reps strength days. */
export function fingerprintStrengthExercises(
  exercises: StrengthExerciseLike[] | null | undefined
): string | null {
  if (!exercises?.length) return null;
  const parts = exercises.map(
    (ex) =>
      `${normName(String(ex.name ?? ""))}:${ex.sets ?? ""}:${String(ex.reps ?? "")}:${ex.rest_seconds ?? ""}`
  );
  if (parts.every((p) => p.startsWith(":"))) return null;
  return parts.join("|");
}

export function fingerprintStrengthPlan(
  title: string,
  days: { title?: string; exercises: StrengthExerciseLike[] }[]
): string | null {
  if (!days.length) return null;
  const dayParts = days.map((d) => {
    const ex = fingerprintStrengthExercises(d.exercises);
    return `${normName(d.title ?? "")}#${ex ?? ""}`;
  });
  if (dayParts.every((p) => p.endsWith("#"))) return null;
  return `${normName(title)}##${dayParts.join("||")}`;
}
