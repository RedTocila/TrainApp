"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatSessionClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SessionCircleButton({
  onClick,
  disabled,
  busy,
  label,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      aria-busy={busy}
      className={cn(
        "inline-flex h-[var(--control-height)] w-[var(--control-height)] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.18)] transition hover:opacity-95 active:scale-[0.97] disabled:opacity-50",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        (children ?? <Play className="h-5 w-5 fill-current" />)
      )}
    </button>
  );
}

export function SessionTopBar({
  title,
  subtitle,
  onBack,
  backHref = "/dashboard",
  backDisabled,
  trailing,
}: {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  backHref?: string;
  backDisabled?: boolean;
  trailing?: ReactNode;
}) {
  const backClass =
    "inline-flex h-[var(--control-height)] w-[var(--control-height)] shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/70 text-foreground transition hover:bg-secondary disabled:opacity-50";

  return (
    <header className="flex shrink-0 items-center gap-2 px-1">
      {onBack ? (
        <button
          type="button"
          className={backClass}
          disabled={backDisabled}
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        <Link href={backHref} className={backClass} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      )}

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-base font-bold tracking-tight text-foreground">
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex h-[var(--control-height)] w-11 shrink-0 items-center justify-end">
        {trailing}
      </div>
    </header>
  );
}

export function SessionStat({
  value,
  label,
  emphasize,
  pulse,
  compact,
}: {
  value: ReactNode;
  label: string;
  emphasize?: boolean;
  /** Soft pulse while a live countdown is running (e.g. rest). */
  pulse?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
      <p
        className={cn(
          "font-mono font-black tabular-nums tracking-tight",
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
          emphasize ? "text-primary" : "text-foreground",
          pulse && "animate-pulse"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "max-w-[6.5rem] text-[0.65rem] font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground",
          pulse && "animate-pulse"
        )}
      >
        {label}
      </p>
    </div>
  );
}

export function SessionStatRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 items-start gap-2 border-y border-border/50 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SessionMediaStage({
  children,
  sideActions,
  className,
  fill = false,
}: {
  children: ReactNode;
  sideActions?: ReactNode;
  className?: string;
  /** When true, the media frame grows to fill remaining flex space (HIIT). */
  fill?: boolean;
}) {
  return (
    <div className={cn("relative z-0 flex min-h-0 flex-col", className)}>
      <div
        className={cn(
          "relative z-0 isolate min-h-0 overflow-hidden rounded-2xl border border-border/50 bg-secondary/30",
          fill && "flex-1"
        )}
      >
        <div className="relative z-0">{children}</div>
        {sideActions ? (
          <div className="pointer-events-auto absolute right-2 top-2 z-50 flex flex-col gap-2">
            {sideActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SessionSideIconButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick?: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-[var(--control-height)] w-[var(--control-height)] items-center justify-center rounded-lg border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-secondary disabled:opacity-40"
    >
      {children}
    </button>
  );
}
