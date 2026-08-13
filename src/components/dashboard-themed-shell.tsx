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
    bar: string;
    wash: string;
  }
> = {
  workout: {
    accent: "text-primary",
    bar: "bg-primary",
    wash: "bg-primary/5",
  },
  nutrition: {
    accent: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    wash: "bg-emerald-500/5",
  },
  water: {
    accent: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    wash: "bg-sky-500/5",
  },
  cardio: {
    accent: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
    wash: "bg-orange-500/5",
  },
  bmi: {
    accent: "text-yellow-800 dark:text-yellow-300",
    bar: "bg-yellow-500",
    wash: "bg-yellow-500/5",
  },
  weight: {
    accent: "text-teal-800 dark:text-teal-300",
    bar: "bg-teal-500",
    wash: "bg-teal-500/5",
  },
  habits: {
    accent: "text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
    wash: "bg-violet-500/5",
  },
  lifestyle: {
    accent: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    wash: "bg-rose-500/5",
  },
  photos: {
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    bar: "bg-fuchsia-500",
    wash: "bg-fuchsia-500/5",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/**
 * Shared dashboard section shell — quiet card surface with a thin theme accent.
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
        "relative flex w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card",
        className
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", t.wash)} aria-hidden />
      <div
        className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", t.bar)}
        aria-hidden
      />
      <div className="relative z-10 flex w-full flex-1 flex-col pl-0.5 text-foreground">
        {children}
      </div>
    </div>
  );
}
