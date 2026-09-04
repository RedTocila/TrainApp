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
  | "lifestyle"
  | "photos";

const THEME: Record<
  DashboardCardTheme,
  {
    accent: string;
    border: string;
    wash: string;
    glow: string;
  }
> = {
  workout: {
    accent: "text-primary",
    border: "border-primary/30",
    wash: "from-primary/18",
    glow: "bg-primary/25",
  },
  nutrition: {
    accent: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    wash: "from-emerald-500/18",
    glow: "bg-emerald-400/25",
  },
  water: {
    accent: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30",
    wash: "from-sky-500/18",
    glow: "bg-sky-400/25",
  },
  cardio: {
    accent: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    wash: "from-orange-500/18",
    glow: "bg-orange-400/25",
  },
  bmi: {
    accent: "text-yellow-800 dark:text-yellow-300",
    border: "border-amber-500/30",
    wash: "from-amber-500/18",
    glow: "bg-amber-400/25",
  },
  weight: {
    accent: "text-teal-800 dark:text-teal-300",
    border: "border-teal-500/30",
    wash: "from-teal-500/18",
    glow: "bg-teal-400/25",
  },
  habits: {
    accent: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
    wash: "from-violet-500/18",
    glow: "bg-violet-400/25",
  },
  lifestyle: {
    accent: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    wash: "from-rose-500/18",
    glow: "bg-rose-400/25",
  },
  photos: {
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-500/30",
    wash: "from-fuchsia-500/18",
    glow: "bg-fuchsia-400/25",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/**
 * Shared dashboard section shell — AI Coach-style accent border, wash, and glow.
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
        "relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
        t.border,
        className
      )}
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br via-card to-card", t.wash)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl",
          t.glow
        )}
      />
      <div className="relative z-10 flex w-full flex-1 flex-col text-foreground">
        {children}
      </div>
    </div>
  );
}
