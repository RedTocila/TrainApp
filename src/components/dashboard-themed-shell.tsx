import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardCardTheme =
  | "workout"
  | "nutrition"
  | "water"
  | "cardio"
  | "bmi"
  | "weight"
  | "habits"
  | "photos";

const THEME: Record<
  DashboardCardTheme,
  {
    from: string;
    radial: string;
    blur: string;
    accent: string;
    border: string;
  }
> = {
  workout: {
    from: "from-primary/38 dark:from-primary/35",
    radial: "rgba(var(--primary-rgb),0.34)",
    blur: "bg-primary/25 dark:bg-primary/15",
    accent: "text-primary",
    border: "border-primary/35 dark:border-primary/25",
  },
  nutrition: {
    from: "from-emerald-500/34 dark:from-emerald-500/30",
    radial: "rgba(16,185,129,0.34)",
    blur: "bg-emerald-400/25 dark:bg-emerald-400/15",
    accent: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40 dark:border-emerald-500/30",
  },
  water: {
    from: "from-sky-400/36 dark:from-sky-400/35",
    radial: "rgba(56,189,248,0.36)",
    blur: "bg-sky-300/30 dark:bg-sky-300/20",
    accent: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/40 dark:border-sky-500/30",
  },
  cardio: {
    from: "from-orange-500/34 dark:from-orange-500/30",
    radial: "rgba(249,115,22,0.36)",
    blur: "bg-orange-400/25 dark:bg-orange-400/15",
    accent: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/40 dark:border-orange-500/30",
  },
  bmi: {
    from: "from-yellow-400/36 dark:from-yellow-400/30",
    radial: "rgba(250,204,21,0.34)",
    blur: "bg-yellow-300/28 dark:bg-yellow-300/15",
    accent: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-500/40 dark:border-yellow-500/30",
  },
  weight: {
    from: "from-teal-500/34 dark:from-teal-500/30",
    radial: "rgba(20,184,166,0.34)",
    blur: "bg-teal-400/25 dark:bg-teal-400/15",
    accent: "text-teal-800 dark:text-teal-300",
    border: "border-teal-500/40 dark:border-teal-500/30",
  },
  habits: {
    from: "from-violet-500/34 dark:from-violet-500/30",
    radial: "rgba(139,92,246,0.34)",
    blur: "bg-violet-400/25 dark:bg-violet-400/15",
    accent: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/40 dark:border-violet-500/30",
  },
  photos: {
    from: "from-fuchsia-500/34 dark:from-fuchsia-500/28",
    radial: "rgba(217,70,239,0.34)",
    blur: "bg-fuchsia-400/25 dark:bg-fuchsia-400/15",
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-500/40 dark:border-fuchsia-500/30",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/**
 * Shared dashboard card shell — colored gradient atmosphere that works in
 * light and dark mode (no flat black fills; text uses theme foreground).
 */
export function DashboardThemedShell({
  theme,
  className,
  children,
  id,
}: {
  theme: DashboardCardTheme;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const t = THEME[theme];
  return (
    <div
      id={id}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-3xl border shadow-sm",
        t.border,
        className
      )}
    >
      <div
        className={cn(
          // Light: keep tint on card surface (avoid washing out to page white).
          // Dark: allow a soft fade into the page background.
          "absolute inset-0 bg-gradient-to-br via-card/55 to-card dark:via-card dark:to-background",
          t.from
        )}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, ${t.radial}, transparent 58%)`,
        }}
        aria-hidden
      />
      <div
        className={cn(
          "absolute -bottom-16 left-1/2 h-40 w-[110%] -translate-x-1/2 rounded-[100%] blur-2xl",
          t.blur
        )}
        aria-hidden
      />
      <div className="relative z-10 flex w-full flex-col text-foreground">
        {children}
      </div>
    </div>
  );
}
