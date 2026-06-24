import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatBar({
  label,
  value,
  max,
  icon: Icon,
  unit = "",
  accentClass = "bg-primary",
}: {
  label: string;
  value: number;
  max: number;
  icon: LucideIcon;
  unit?: string;
  accentClass?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold">
          {value}
          {unit}
          <span className="text-xs font-normal text-muted-foreground"> / {max}{unit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", accentClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
