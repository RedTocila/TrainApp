import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared dashboard surface tokens (nutrition-detail style). */
export const dashboard = {
  tile: "rounded-2xl border border-border/60 bg-card/80 transition-[border-color,box-shadow,background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  tileInteractive:
    "pressable rounded-2xl border border-border/60 bg-card/80 transition-[border-color,box-shadow,background-color,transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border hover:bg-card active:scale-[0.99]",
  metricTile:
    "flex min-h-[9.5rem] flex-col justify-between rounded-2xl border border-border/60 bg-card/80 p-3 transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  heroTile:
    "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-5",
  listRow:
    "flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 backdrop-blur-sm transition-[background-color,border-color,transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-background/35",
  empty:
    "rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground backdrop-blur-sm",
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
    "pressable inline-flex flex-1 touch-manipulation select-none items-center justify-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur-sm transition-[transform,opacity,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [-webkit-tap-highlight-color:transparent] active:scale-[0.97] active:opacity-90 hover:border-primary/30 hover:bg-background/80 dark:bg-background/40",
  /** Side-by-side water/cardio tiles — equal height, content clipped inside. */
  pairTile:
    "relative flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-3.5 md:p-4",
  /** One line below trigger; aligned to the end (icon menus). */
  dropdownPanelBelowEnd: "absolute right-0 top-full z-30 mt-1",
  /** Cursor-style stack: main bar + attached tail sharing one outer border. */
  attachedDropdown:
    "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  attachedDropdownMain:
    "flex items-start gap-3 px-3 py-2.5",
  attachedDropdownTail:
    "border-t border-border/60 bg-secondary/25",
  attachedDropdownTailToggle:
    "flex w-full touch-manipulation select-none items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-[background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-secondary/40 active:bg-secondary/50",
  dropdownItem:
    "flex w-full touch-manipulation select-none items-start gap-3 px-3 py-2.5 text-left text-sm transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-secondary/80 active:bg-secondary/60",
  /** Detached menu surface (floats outside the trigger border box). */
  dropdownPanel:
    "overflow-hidden rounded-xl border border-border bg-card shadow-xl ring-1 ring-border/30",
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
    <div className="flex justify-center gap-1">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(index);
          }}
          className="flex h-6 w-6 touch-manipulation items-center justify-center rounded-full"
          aria-label={getLabel?.(index) ?? `Slide ${index + 1}`}
          aria-current={active === index ? "true" : undefined}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              active === index
                ? "bg-foreground"
                : "bg-muted-foreground/40"
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
