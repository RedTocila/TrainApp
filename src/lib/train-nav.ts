export const trainTabs = [
  { href: "/dashboard/workout/plans", label: "Workout" },
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

/** Full-screen workout session UIs — hide train tabs + bottom nav. */
export function isActiveWorkoutSessionPath(pathname: string) {
  const path = pathOnly(pathname);
  return /^\/dashboard\/workout\/session\/[^/]+$/.test(path);
}

/** Live cardio session — custom Cardio header, no Workout/Nutrition toggle. */
export function isCardioSessionPath(pathname: string) {
  return pathOnly(pathname) === "/dashboard/workout/cardio/session";
}

/** Hide logo / train tabs / bottom nav for immersive pages. */
export function hidesDashboardChrome(pathname: string) {
  return isActiveWorkoutSessionPath(pathname);
}

/** Bottom nav only — cardio session keeps the Cardio header, hides the dock. */
export function hidesDashboardBottomNav(pathname: string) {
  return hidesDashboardChrome(pathname) || isCardioSessionPath(pathname);
}

/** Workout/Nutrition segment — hidden on cardio session (uses its own header). */
export function showsTrainSectionTabs(pathname: string) {
  return (
    isTrainPath(pathname) &&
    !hidesDashboardChrome(pathname) &&
    !isCardioSessionPath(pathname)
  );
}

/** Active workout sessions are opened from Home — don't highlight Programs. */
export function isProgramsNavActive(pathname: string) {
  return isTrainPath(pathname) && !hidesDashboardChrome(pathname);
}

export function isHomeNavActive(pathname: string) {
  const path = pathOnly(pathname);
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/day/") ||
    isActiveWorkoutSessionPath(path)
  );
}

/** Full calendar entry — only on the 5 primary navbar destinations. */
export function showsFullCalendarNav(pathname: string) {
  const path = pathOnly(pathname);
  if (isHomeNavActive(path) && !isActiveWorkoutSessionPath(path)) return true;
  if (isProgramsNavActive(path)) return true;
  if (path === "/dashboard/classes" || path.startsWith("/dashboard/classes/")) {
    return true;
  }
  if (path === "/dashboard/profile" || path.startsWith("/dashboard/profile/")) {
    return true;
  }
  if (path === "/dashboard/ai" || path.startsWith("/dashboard/ai/")) return true;
  return false;
}

export function isTrainTabActive(pathname: string, href: string) {
  const path = pathOnly(pathname);
  // Workout tab covers My workout, Programs, Exercises, Cardio, etc.
  if (href.startsWith("/dashboard/workout")) {
    return (
      path === "/dashboard/workout" || path.startsWith("/dashboard/workout/")
    );
  }
  return path === href || path.startsWith(`${href}/`);
}
