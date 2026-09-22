/** Whitelisted dashboard routes Coach Alex may open in Act mode. */

export const COACH_NAVIGATE_ALIASES: Record<string, string> = {
  home: "/dashboard",
  dashboard: "/dashboard",
  profile: "/dashboard/profile",
  settings: "/dashboard/profile",
  programs: "/dashboard/workout",
  workouts: "/dashboard/workout",
  workout: "/dashboard/workout",
  "workout schedule": "/dashboard/workout/schedule",
  schedule: "/dashboard/workout/schedule",
  cardio: "/dashboard/workout/cardio",
  exercises: "/dashboard/workout/exercises",
  nutrition: "/dashboard/nutrition",
  meals: "/dashboard/nutrition/meals",
  habits: "/dashboard",
  "add habit": "/dashboard/habits/new",
  ai: "/dashboard/ai",
  coach: "/dashboard/ai",
  "progress photos": "/dashboard/progress-photos",
  photos: "/dashboard/progress-photos",
  challenges: "/dashboard/classes",
  classes: "/dashboard/classes",
  pricing: "/dashboard/pricing",
  referrals: "/dashboard/referrals",
};

const ALLOWED_PREFIXES = [
  "/dashboard",
] as const;

const BLOCKED_SEGMENTS = [
  "/checkout",
  "/session/",
];

export function isAllowedCoachNavigatePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.includes("..") || path.includes("//")) return false;
  if (!ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }
  if (BLOCKED_SEGMENTS.some((s) => path.includes(s))) return false;
  return true;
}

/**
 * Resolve a page key or path to a safe dashboard href.
 * Accepts aliases ("programs") or absolute paths ("/dashboard/workout").
 */
export function resolveCoachNavigatePath(
  input: string
): { href: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Page is required" };

  const lower = raw.toLowerCase();
  const alias = COACH_NAVIGATE_ALIASES[lower];
  if (alias) return { href: alias };

  // Strip origin if the model pasted a full URL.
  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      path = new URL(raw).pathname;
    }
  } catch {
    return { error: "Invalid page path" };
  }

  if (!path.startsWith("/")) {
    const alias2 = COACH_NAVIGATE_ALIASES[path.toLowerCase()];
    if (alias2) return { href: alias2 };
    path = `/dashboard/${path.replace(/^\/+/, "")}`;
  }

  if (!isAllowedCoachNavigatePath(path)) {
    return {
      error: `Cannot open "${raw}". Allowed examples: home, profile, programs, workout schedule, cardio, nutrition, habits, ai, progress photos.`,
    };
  }

  return { href: path };
}
