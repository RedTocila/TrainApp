import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared dashboard surface tokens (nutrition-detail style). */
export const dashboard = {
  tile: "rounded-2xl border border-border/60 bg-card/80",
  tileInteractive:
    "rounded-2xl border border-border/60 bg-card/80 transition-colors hover:border-border hover:bg-card active:scale-[0.99]",
  metricTile: "flex min-h-[9.5rem] flex-col justify-between rounded-2xl border border-border/60 bg-card/80 p-3",
  heroTile:
    "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5",
  listRow:
    "flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 transition-colors",
  empty:
    "rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground",
  section: "space-y-4",
  sectionHeading: "text-base font-bold",
  pageTitle: "text-xl font-black tracking-tight sm:text-2xl",
  cardTitle: "flex items-center gap-2 text-lg font-black",
  heroValue: "text-4xl font-black tabular-nums tracking-tight sm:text-5xl",
  metricValue: "text-2xl font-black tabular-nums leading-none",
  label: "text-xs text-muted-foreground",
  completedTile: "border-green-500/25 bg-green-500/5",
  missedTile: "border-red-500/25 bg-red-500/5",
  warningTile: "border-orange-500/30 bg-orange-500/5",
  chipButton:
    "inline-flex flex-1 touch-manipulation select-none items-center justify-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-2 text-sm font-semibold transition-colors [-webkit-tap-highlight-color:transparent] active:opacity-90 hover:border-primary/30 hover:bg-secondary/80",
  pairTile:
    "relative flex h-full min-h-[13rem] flex-col p-3 sm:min-h-[14rem] sm:p-4",
} as const;

export function DashboardTile({
  className,
  interactive,
  completed,
  missed,
  warning,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  completed?: boolean;
  missed?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        interactive ? dashboard.tileInteractive : dashboard.tile,
        completed && dashboard.completedTile,
        missed && dashboard.missedTile,
        warning && dashboard.warningTile,
        className
      )}
      {...props}
    />
  );
}

export function DashboardSectionHeading({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn(dashboard.sectionHeading, className)} {...props} />;
}

export function DashboardEmptyState({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(dashboard.empty, className)} {...props} />;
}

export function DashboardCarouselDots({
  count,
  active,
  onSelect,
  getLabel,
}: {
  count: number;
  active: number;
  onSelect: (index: number) => void;
  getLabel?: (index: number) => string;
}) {
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(index);
          }}
          className="flex h-8 min-w-8 touch-manipulation items-center justify-center rounded-full"
          aria-label={getLabel?.(index) ?? `Slide ${index + 1}`}
          aria-current={active === index ? "true" : undefined}
        >
          <span
            className={cn(
              "rounded-full transition-all",
              active === index
                ? "h-1.5 w-5 bg-foreground"
                : "h-1.5 w-1.5 bg-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function DashboardSectionHeader({
  icon: Icon,
  title,
  iconClassName = "text-primary",
  action,
  badge,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  iconClassName?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={dashboard.cardTitle}>
          <Icon className={cn("h-5 w-5 shrink-0", iconClassName)} />
          <span className="truncate">{title}</span>
          {badge}
        </div>
        {subtitle ? (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function DashboardCompletedBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400",
        className
      )}
    >
      {children}
    </span>
  );
}

export const DashboardStatusPill = DashboardCompletedBadge;
