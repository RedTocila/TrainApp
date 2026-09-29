/**
 * Weekly split focus titles that respect removed day types and avoided muscles.
 * Pure — no LLM, no I/O.
 */

import {
  DAY_FOCUS_MUSCLES,
  DAY_TITLE_PATTERNS,
  type DayFocusId,
} from "@/lib/ai/constraint-language";
import type { WorkoutRequirements } from "@/lib/ai/workout-requirements";

type FocusReq = Pick<WorkoutRequirements, "excludedDayFocuses" | "avoidMuscles">;

const ALL_FOCUS_IDS = Object.keys(DAY_TITLE_PATTERNS) as DayFocusId[];

/** Substitutes in preference order; only those without conflicts are used. */
const SUBSTITUTE_FOCUSES = [
  "Push",
  "Pull",
  "Upper body",
  "Legs",
  "Chest & back",
  "Arms & core",
  "Core & conditioning",
  "Full body",
];

function focusIdsInTitle(title: string): DayFocusId[] {
  return ALL_FOCUS_IDS.filter((id) => DAY_TITLE_PATTERNS[id].test(title));
}

/** Why a focus title contradicts the constraints (null = fine). */
export function focusConflict(title: string, req: FocusReq): string | null {
  const ids = focusIdsInTitle(title);
  for (const id of ids) {
    if (req.excludedDayFocuses.includes(id)) return `${id.replace(/_/g, " ")} day was removed`;
  }
  const avoid = new Set(req.avoidMuscles);
  if (!avoid.size) return null;
  const legsAvoided = DAY_FOCUS_MUSCLES.legs.every((g) => avoid.has(g));
  if (legsAvoided && (ids.includes("legs") || ids.includes("full_body"))) {
    return "legs are excluded";
  }
  for (const id of ids) {
    const groups = DAY_FOCUS_MUSCLES[id];
    if (!groups.length) continue;
    const share = groups.filter((g) => avoid.has(g)).length / groups.length;
    if (share >= 0.6) return `${id.replace(/_/g, " ")} muscles are excluded`;
  }
  return null;
}

/**
 * Replace conflicting focuses and force exactly `daysPerWeek` entries.
 * Keeps compliant titles in place; substitutes avoid duplicates where possible.
 */
export function sanitizeDayFocuses(
  focuses: readonly string[],
  req: FocusReq,
  daysPerWeek: number
): { focuses: string[]; replaced: { from: string; to: string; reason: string }[] } {
  const n = Math.max(1, Math.round(daysPerWeek));
  const allowedSubs = SUBSTITUTE_FOCUSES.filter((f) => !focusConflict(f, req));
  const subs = allowedSubs.length ? allowedSubs : ["Core & conditioning"];
  const out: string[] = [];
  const replaced: { from: string; to: string; reason: string }[] = [];

  const nextSub = (): string => {
    const lowerUsed = new Set(out.map((f) => f.toLowerCase()));
    const fresh = subs.find((s) => !lowerUsed.has(s.toLowerCase()));
    if (fresh) return fresh;
    const base = subs[out.length % subs.length]!;
    return `${base} B`;
  };

  for (const focus of focuses.slice(0, n)) {
    const reason = focusConflict(focus, req);
    if (!reason) {
      out.push(focus);
      continue;
    }
    const to = nextSub();
    replaced.push({ from: focus, to, reason });
    out.push(to);
  }
  while (out.length < n) out.push(nextSub());
  return { focuses: out, replaced };
}
