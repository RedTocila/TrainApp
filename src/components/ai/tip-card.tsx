import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  default: {
    border: "border-border/60",
    wash: "from-secondary/40",
    glow: "bg-foreground/5",
    iconWell: "bg-secondary text-foreground",
  },
  success: {
    border: "border-emerald-500/30",
    wash: "from-emerald-500/18",
    glow: "bg-emerald-400/25",
    iconWell: "bg-emerald-500/15 text-emerald-400",
  },
  warning: {
    border: "border-amber-500/30",
    wash: "from-amber-500/18",
    glow: "bg-amber-400/25",
    iconWell: "bg-amber-500/15 text-amber-400",
  },
  primary: {
    border: "border-primary/30",
    wash: "from-primary/18",
    glow: "bg-primary/25",
    iconWell: "bg-primary/15 text-primary",
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
  amber: {
    border: "border-amber-500/30",
    wash: "from-amber-500/18",
    glow: "bg-amber-400/25",
    iconWell: "bg-amber-500/15 text-amber-400",
  },
} as const;

export type TipCardTone = keyof typeof TONES;

export function TipCard({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: TipCardTone;
}) {
  const t = TONES[tone] ?? TONES.default;

  return (
    <div
      className={cn(
        "relative flex gap-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm",
        t.border
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br via-card to-card", t.wash)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl",
          t.glow
        )}
      />
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          t.iconWell
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
