import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiFeatureTile({
  href,
  icon: Icon,
  label,
  accentClass = "text-primary",
  bgClass = "bg-primary/10",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  accentClass?: string;
  bgClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          bgClass
        )}
      >
        <Icon className={cn("h-6 w-6", accentClass)} />
      </div>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function FlowStep({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2",
          active
            ? "border-primary bg-primary/15 text-primary"
            : "border-border bg-secondary/50 text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-center text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
