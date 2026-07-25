export const trainTabs = [
  { href: "/dashboard/workout", label: "Workout" },
  { href: "/dashboard/nutrition", label: "Nutrition" },
] as const;

function pathOnly(pathname: string) {
  const q = pathname.indexOf("?");
  return q === -1 ? pathname : pathname.slice(0, q);
}

export function isTrainPath(pathname: string) {
  const path = pathOnly(pathname);
  return (
    path === "/dashboard/workout" ||
    path.startsWith("/dashboard/workout/") ||
    path === "/dashboard/nutrition" ||
    path.startsWith("/dashboard/nutrition/")
  );
}

/** Full-screen session UIs — hide train tabs + bottom nav (workout + cardio). */
export function isActiveWorkoutSessionPath(pathname: string) {
  const path = pathOnly(pathname);
  return (
    /^\/dashboard\/workout\/session\/[^/]+$/.test(path) ||
    path === "/dashboard/workout/cardio/session"
  );
}

/** Active workout sessions are opened from Home — don't highlight Programs. */
export function isProgramsNavActive(pathname: string) {
  return isTrainPath(pathname) && !isActiveWorkoutSessionPath(pathname);
}

export function isHomeNavActive(pathname: string) {
  const path = pathOnly(pathname);
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/day/") ||
    isActiveWorkoutSessionPath(path)
  );
}

export function isTrainTabActive(pathname: string, href: string) {
  const path = pathOnly(pathname);
  return path === href || path.startsWith(`${href}/`);
}
