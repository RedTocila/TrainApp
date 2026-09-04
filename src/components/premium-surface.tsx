import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  primary: {
    border: "border-primary/30",
    wash: "from-primary/18",
    glow: "bg-primary/25",
    iconWell: "bg-primary/15 text-primary",
  },
  amber: {
    border: "border-amber-500/30",
    wash: "from-amber-500/18",
    glow: "bg-amber-400/25",
    iconWell: "bg-amber-500/15 text-amber-400",
  },
  violet: {
    border: "border-violet-500/30",
    wash: "from-violet-500/18",
    glow: "bg-violet-400/25",
    iconWell: "bg-violet-500/15 text-violet-400",
  },
  cyan: {
    border: "border-cyan-500/35",
    wash: "from-cyan-500/18",
    glow: "bg-cyan-400/25",
    iconWell: "bg-cyan-500/15 text-cyan-400",
  },
  rose: {
    border: "border-rose-500/30",
    wash: "from-rose-500/18",
    glow: "bg-rose-400/25",
    iconWell: "bg-rose-500/15 text-rose-400",
  },
  emerald: {
    border: "border-emerald-500/30",
    wash: "from-emerald-500/18",
    glow: "bg-emerald-400/25",
    iconWell: "bg-emerald-500/15 text-emerald-400",
  },
  neutral: {
    border: "border-border/60",
    wash: "from-secondary/30",
    glow: "bg-foreground/5",
    iconWell: "bg-secondary text-foreground",
  },
} as const;

export type PremiumSurfaceAccent = keyof typeof ACCENTS;

/** AI Coach–style surface used across dashboard + AI subpages. */
export function PremiumSurface({
  className,
  children,
  accent = "neutral",
  rounded = "2xl",
}: {
  className?: string;
  children: ReactNode;
  accent?: PremiumSurfaceAccent;
  rounded?: "2xl" | "3xl";
}) {
  const t = ACCENTS[accent];
  return (
    <div
      className={cn(
        "relative overflow-hidden border bg-card shadow-sm",
        rounded === "3xl" ? "rounded-3xl" : "rounded-2xl",
        t.border,
        className
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br via-card to-card", t.wash)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl",
          t.glow
        )}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function PremiumSurfaceHeader({
  icon: Icon,
  title,
  accent = "primary",
  action,
}: {
  icon: LucideIcon;
  title: string;
  accent?: PremiumSurfaceAccent;
  action?: ReactNode;
}) {
  const t = ACCENTS[accent];
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            t.iconWell
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
      </div>
      {action}
    </div>
  );
}
