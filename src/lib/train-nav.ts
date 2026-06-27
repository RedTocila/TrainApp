export const trainTabs = [
  { href: "/dashboard/workout", label: "Workout" },
  { href: "/dashboard/nutrition", label: "Nutrition" },
] as const;

export function isTrainPath(pathname: string) {
  return (
    pathname === "/dashboard/workout" ||
    pathname.startsWith("/dashboard/workout/") ||
    pathname === "/dashboard/nutrition" ||
    pathname.startsWith("/dashboard/nutrition/")
  );
}

export function isActiveWorkoutSessionPath(pathname: string) {
  return /^\/dashboard\/workout\/session\/[^/]+$/.test(pathname);
}

/** Active workout sessions are opened from Home — don't highlight Programs. */
export function isProgramsNavActive(pathname: string) {
  return isTrainPath(pathname) && !isActiveWorkoutSessionPath(pathname);
}

export function isHomeNavActive(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/day/") ||
    isActiveWorkoutSessionPath(pathname)
  );
}

export function isTrainTabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
