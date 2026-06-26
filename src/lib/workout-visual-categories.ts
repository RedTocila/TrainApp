import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Moon,
  PersonStanding,
  Target,
} from "lucide-react";

export type WorkoutCategory =
  | "push"
  | "pull"
  | "legs"
  | "full"
  | "cardio"
  | "core"
  | "upper"
  | "rest"
  | "general";

export interface WorkoutCategoryStyle {
  id: WorkoutCategory;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  stripe: string;
  chip: string;
  chipText: string;
  iconBg: string;
  iconText: string;
  cardBorder: string;
  cardBg: string;
  scheduleBg: string;
  scheduleText: string;
}

const CATEGORY_STYLES: Record<WorkoutCategory, WorkoutCategoryStyle> = {
  push: {
    id: "push",
    label: "Push",
    shortLabel: "Push",
    icon: ArrowUp,
    stripe: "bg-rose-500",
    chip: "bg-rose-500/20 border-rose-500/40",
    chipText: "text-rose-300",
    iconBg: "bg-rose-500/20",
    iconText: "text-rose-400",
    cardBorder: "border-rose-500/35",
    cardBg: "bg-rose-500/[0.06]",
    scheduleBg: "bg-rose-500/10",
    scheduleText: "text-rose-300",
  },
  pull: {
    id: "pull",
    label: "Pull",
    shortLabel: "Pull",
    icon: ArrowDown,
    stripe: "bg-blue-500",
    chip: "bg-blue-500/20 border-blue-500/40",
    chipText: "text-blue-300",
    iconBg: "bg-blue-500/20",
    iconText: "text-blue-400",
    cardBorder: "border-blue-500/35",
    cardBg: "bg-blue-500/[0.06]",
    scheduleBg: "bg-blue-500/10",
    scheduleText: "text-blue-300",
  },
  legs: {
    id: "legs",
    label: "Legs",
    shortLabel: "Legs",
    icon: Footprints,
    stripe: "bg-emerald-500",
    chip: "bg-emerald-500/20 border-emerald-500/40",
    chipText: "text-emerald-300",
    iconBg: "bg-emerald-500/20",
    iconText: "text-emerald-400",
    cardBorder: "border-emerald-500/35",
    cardBg: "bg-emerald-500/[0.06]",
    scheduleBg: "bg-emerald-500/10",
    scheduleText: "text-emerald-300",
  },
  full: {
    id: "full",
    label: "Full body",
    shortLabel: "Full",
    icon: PersonStanding,
    stripe: "bg-violet-500",
    chip: "bg-violet-500/20 border-violet-500/40",
    chipText: "text-violet-300",
    iconBg: "bg-violet-500/20",
    iconText: "text-violet-400",
    cardBorder: "border-violet-500/35",
    cardBg: "bg-violet-500/[0.06]",
    scheduleBg: "bg-violet-500/10",
    scheduleText: "text-violet-300",
  },
  cardio: {
    id: "cardio",
    label: "Cardio",
    shortLabel: "Cardio",
    icon: Flame,
    stripe: "bg-orange-500",
    chip: "bg-orange-500/20 border-orange-500/40",
    chipText: "text-orange-300",
    iconBg: "bg-orange-500/20",
    iconText: "text-orange-400",
    cardBorder: "border-orange-500/35",
    cardBg: "bg-orange-500/[0.06]",
    scheduleBg: "bg-orange-500/10",
    scheduleText: "text-orange-300",
  },
  core: {
    id: "core",
    label: "Core",
    shortLabel: "Core",
    icon: Target,
    stripe: "bg-amber-500",
    chip: "bg-amber-500/20 border-amber-500/40",
    chipText: "text-amber-300",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-400",
    cardBorder: "border-amber-500/35",
    cardBg: "bg-amber-500/[0.06]",
    scheduleBg: "bg-amber-500/10",
    scheduleText: "text-amber-300",
  },
  upper: {
    id: "upper",
    label: "Upper",
    shortLabel: "Upper",
    icon: Layers,
    stripe: "bg-cyan-500",
    chip: "bg-cyan-500/20 border-cyan-500/40",
    chipText: "text-cyan-300",
    iconBg: "bg-cyan-500/20",
    iconText: "text-cyan-400",
    cardBorder: "border-cyan-500/35",
    cardBg: "bg-cyan-500/[0.06]",
    scheduleBg: "bg-cyan-500/10",
    scheduleText: "text-cyan-300",
  },
  rest: {
    id: "rest",
    label: "Rest",
    shortLabel: "Rest",
    icon: Moon,
    stripe: "bg-slate-500",
    chip: "bg-slate-500/20 border-slate-500/40",
    chipText: "text-slate-300",
    iconBg: "bg-slate-500/20",
    iconText: "text-slate-400",
    cardBorder: "border-slate-500/35",
    cardBg: "bg-slate-500/[0.06]",
    scheduleBg: "bg-slate-500/10",
    scheduleText: "text-slate-300",
  },
  general: {
    id: "general",
    label: "Workout",
    shortLabel: "Train",
    icon: Dumbbell,
    stripe: "bg-primary",
    chip: "bg-primary/15 border-primary/30",
    chipText: "text-primary",
    iconBg: "bg-primary/15",
    iconText: "text-primary",
    cardBorder: "border-primary/25",
    cardBg: "bg-primary/[0.04]",
    scheduleBg: "bg-primary/10",
    scheduleText: "text-primary",
  },
};

/** Categories used for auto-detecting workout type (card colors, etc.). */
const INFERENCE_CATEGORIES: WorkoutCategory[] = [
  "push",
  "pull",
  "legs",
  "full",
  "core",
  "upper",
  "rest",
];

/** Shown in the filter strip. */
export const WORKOUT_FILTER_CATEGORIES: WorkoutCategory[] = INFERENCE_CATEGORIES;

/** @deprecated Use WORKOUT_FILTER_CATEGORIES */
export const WORKOUT_LEGEND_CATEGORIES = WORKOUT_FILTER_CATEGORIES;

const KEYWORD_SCORES: Record<WorkoutCategory, string[]> = {
  push: [
    "push",
    "chest",
    "shoulder",
    "tricep",
    "triceps",
    "dip",
    "press",
    "pec",
    "incline",
    "fly",
    "overhead",
  ],
  pull: [
    "pull",
    "back",
    "row",
    "lat",
    "lats",
    "bicep",
    "biceps",
    "curl",
    "chin",
    "pulldown",
  ],
  legs: [
    "leg",
    "legs",
    "squat",
    "lunge",
    "glute",
    "quad",
    "hamstring",
    "calf",
    "rdl",
    "deadlift",
    "hip thrust",
    "split squat",
  ],
  full: ["full body", "full-body", "total body", "whole body", "fbw", "fullbody"],
  cardio: [
    "cardio",
    "hiit",
    "run",
    "running",
    "bike",
    "cycling",
    "rower",
    "conditioning",
    "sprint",
    "jump rope",
    "elliptical",
  ],
  core: ["core", "abs", "ab ", "plank", "crunch", "oblique"],
  upper: ["upper", "upper body", "torso"],
  rest: ["rest", "recovery", "deload", "mobility", "stretch", "yoga", "off day"],
  general: [],
};

function normalizeText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
}

function scoreCategory(text: string, category: WorkoutCategory): number {
  if (category === "general") return 0;
  let score = 0;
  for (const keyword of KEYWORD_SCORES[category]) {
    if (text.includes(keyword)) {
      score += keyword.includes(" ") ? 3 : 1;
    }
  }
  return score;
}

export function inferWorkoutCategoryFromText(...parts: (string | null | undefined)[]): WorkoutCategory {
  const text = normalizeText(parts);
  if (!text.trim()) return "general";

  let best: WorkoutCategory = "general";
  let bestScore = 0;

  for (const category of INFERENCE_CATEGORIES) {
    const score = scoreCategory(text, category);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  if (bestScore === 0) return "general";
  return best;
}

export function getWorkoutCategoryStyle(category: WorkoutCategory): WorkoutCategoryStyle {
  return CATEGORY_STYLES[category];
}

export function inferDayCategory(day: {
  title: string;
  exercises?: { name: string }[] | null;
}): WorkoutCategory {
  const exerciseNames = (day.exercises ?? []).map((e) => e.name);
  return inferWorkoutCategoryFromText(day.title, ...exerciseNames);
}

export function inferProgramCategory(
  planTitle: string,
  days: { title: string; exercises?: { name: string }[] | null }[]
): WorkoutCategory {
  if (days.length === 0) {
    return inferWorkoutCategoryFromText(planTitle);
  }

  const dayCategories = days.map((day) => inferDayCategory(day));
  const unique = [...new Set(dayCategories.filter((c) => c !== "general"))];

  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return inferWorkoutCategoryFromText(planTitle) !== "general"
    ? inferWorkoutCategoryFromText(planTitle)
    : "full";

  return inferWorkoutCategoryFromText(planTitle, ...days.map((d) => d.title));
}

export function getProgramStripeClasses(
  planTitle: string,
  days: { title: string; exercises?: { name: string }[] | null }[]
): string {
  const dayCategories = days.map((day) => inferDayCategory(day));
  const unique = [...new Set(dayCategories.filter((c) => c !== "general"))];

  if (unique.length <= 1) {
    const category = unique[0] ?? inferProgramCategory(planTitle, days);
    return getWorkoutCategoryStyle(category).stripe;
  }

  const stripes = unique.slice(0, 4).map((c) => getWorkoutCategoryStyle(c).stripe);
  return stripes.join(" ");
}

export function isMultiCategoryProgram(
  days: { title: string; exercises?: { name: string }[] | null }[]
): boolean {
  const dayCategories = days.map((day) => inferDayCategory(day));
  const unique = [...new Set(dayCategories.filter((c) => c !== "general"))];
  return unique.length > 1;
}

export type WorkoutCategoryFilter = WorkoutCategory | "all";

export function workoutMatchesCategory(
  planTitle: string,
  days: { title: string; exercises?: { name: string }[] | null }[],
  filter: WorkoutCategoryFilter
): boolean {
  if (filter === "all") return true;
  if (inferProgramCategory(planTitle, days) === filter) return true;
  return days.some((day) => inferDayCategory(day) === filter);
}

export function countWorkoutsByCategory(
  workouts: { plan: { title: string }; days: { title: string; exercises?: { name: string }[] | null }[] }[]
): Record<WorkoutCategoryFilter, number> {
  const counts: Record<WorkoutCategoryFilter, number> = {
    all: workouts.length,
    push: 0,
    pull: 0,
    legs: 0,
    full: 0,
    cardio: 0,
    core: 0,
    upper: 0,
    rest: 0,
    general: 0,
  };

  for (const { plan, days } of workouts) {
    for (const category of INFERENCE_CATEGORIES) {
      if (workoutMatchesCategory(plan.title, days, category)) {
        counts[category]++;
      }
    }
    if (workoutMatchesCategory(plan.title, days, "general")) {
      counts.general++;
    }
  }

  return counts;
}
