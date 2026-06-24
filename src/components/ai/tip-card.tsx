import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TipCard({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "primary";
}) {
  const tones = {
    default: "border-border bg-secondary/20",
    success: "border-green-500/30 bg-green-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    primary: "border-primary/30 bg-primary/5",
  };

  const iconTones = {
    default: "bg-secondary text-foreground",
    success: "bg-green-500/15 text-green-400",
    warning: "bg-amber-500/15 text-amber-400",
    primary: "bg-primary/15 text-primary",
  };

  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", tones[tone])}>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          iconTones[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
