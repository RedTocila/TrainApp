import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgramQuickTile({
  href,
  icon: Icon,
  label,
  onClick,
  accentClass = "text-primary",
  bgClass = "bg-primary/10",
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  accentClass?: string;
  bgClass?: string;
}) {
  const className = cn(
    "flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-center transition-colors",
    (href || onClick) && "hover:border-primary/40 hover:bg-secondary/40"
  );

  const content = (
    <>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bgClass)}>
        <Icon className={cn("h-5 w-5", accentClass)} />
      </div>
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function ProgramFolderCard({
  href,
  name,
  count,
  countLabel,
  icon: Icon,
}: {
  href: string;
  name: string;
  count: number;
  countLabel: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/30"
    >
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
        <span className="mt-0.5 text-lg font-black leading-none">{count}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{countLabel}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${Math.min(100, count * 20)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
