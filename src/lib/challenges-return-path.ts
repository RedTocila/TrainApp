const STORAGE_KEY = "rutina-challenges-return";

let memory: string | null = null;
const listeners = new Set<() => void>();

export function isChallengesPath(path: string) {
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname === "/dashboard/challenges" ||
    pathname.startsWith("/dashboard/challenges/")
  );
}

function readStoredPath() {
  if (typeof window === "undefined") return "/dashboard";
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && stored.startsWith("/dashboard") && !isChallengesPath(stored)) {
      return stored;
    }
  } catch {
    // Ignore unreadable storage.
  }
  return "/dashboard";
}

/** Remember the dashboard screen that opened challenges, so Back can return there. */
export function rememberChallengesReturnPath(path: string) {
  if (typeof window === "undefined") return;
  const pathname = path.split("?")[0] ?? path;
  if (!pathname.startsWith("/dashboard") || isChallengesPath(pathname)) return;
  memory = pathname;
  try {
    sessionStorage.setItem(STORAGE_KEY, pathname);
  } catch {
    // Private mode can block storage.
  }
  listeners.forEach((listener) => listener());
}

export function readChallengesReturnPath() {
  if (!memory) memory = readStoredPath();
  return memory;
}

export function subscribeChallengesReturn(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
