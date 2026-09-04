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
      className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 text-center shadow-sm transition-[transform,border-color] duration-200 hover:border-primary/50 active:scale-[0.99]"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-primary/12 via-card to-card"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-primary/20 blur-2xl"
      />
      <div
        className={cn(
          "relative z-10 flex h-12 w-12 items-center justify-center rounded-full",
          bgClass
        )}
      >
        <Icon className={cn("h-6 w-6", accentClass)} />
      </div>
      <span className="relative z-10 text-xs font-semibold leading-tight">{label}</span>
      <ArrowRight className="relative z-10 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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
            ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]"
            : "border-border bg-secondary/50 text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-center text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
