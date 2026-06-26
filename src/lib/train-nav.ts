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

export function isTrainTabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
