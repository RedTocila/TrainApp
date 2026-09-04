import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared dashboard surface tokens — AI Coach chrome: accent borders, soft depth. */
export const dashboard = {
  tile: "rounded-2xl border border-border/60 bg-card shadow-sm transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  tileInteractive:
    "pressable rounded-2xl border border-border/60 bg-card shadow-sm transition-[border-color,background-color,transform,opacity,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/35 hover:shadow-md active:scale-[0.99]",
  metricTile:
    "relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  heroTile:
    "relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-sm transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-5",
  listRow:
    "flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/35 p-3 transition-[background-color,transform,opacity,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  empty:
    "rounded-2xl border border-dashed border-border/60 bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground",
  section: "space-y-4",
  sectionHeading: "text-base font-bold",
  pageTitle: "text-xl font-black tracking-tight sm:text-2xl",
  cardTitle: "flex items-center gap-2 text-lg font-black",
  heroValue: "text-4xl font-black tabular-nums tracking-tight sm:text-5xl",
  metricValue: "text-2xl font-black tabular-nums leading-none",
  label: "text-xs text-muted-foreground",
  completedTile: "border-green-500/35 bg-green-500/5",
  missedTile: "border-red-500/35 bg-red-500/5",
  warningTile: "border-orange-500/40 bg-orange-500/5",
  chipButton:
    "pressable inline-flex flex-1 touch-manipulation select-none items-center justify-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur-sm transition-[transform,opacity,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [-webkit-tap-highlight-color:transparent] active:scale-[0.97] active:opacity-90 hover:border-primary/50 hover:bg-primary/10 dark:bg-background/40",
  /**
   * Side-by-side water/cardio tiles — matching min-height (never height:100%).
   * iPad Safari + % heights collapses the row so BMI paints over the pair.
   */
  pairTile:
    "relative box-border flex w-full flex-col overflow-hidden p-2.5 sm:p-3 min-h-[15rem] sm:min-h-[15.5rem]",
  /** Footer row shared by pair tiles — fixed height when actions change. */
  pairFooter: "mt-auto flex h-8 shrink-0 items-end gap-1.5 pt-1.5",
  /** One reserved caption line under the pair visual (remaining / empty). */
  pairCaption:
    "mt-0.5 min-h-[0.875rem] truncate px-1 text-center text-[10px] leading-tight text-muted-foreground",
  /** One line below trigger; aligned to the end (icon menus). */
  dropdownPanelBelowEnd: "absolute right-0 top-full z-30 mt-1",
  /** Cursor-style stack: main bar + attached tail sharing one outer border. */
  attachedDropdown:
    "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-[border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  attachedDropdownMain:
    "flex items-start gap-3 px-3 py-2.5",
  attachedDropdownTail:
    "border-t border-border/40 bg-secondary/25",
  attachedDropdownTailToggle:
    "flex w-full touch-manipulation select-none items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-[background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-secondary/40 active:bg-secondary/50",
  dropdownItem:
    "flex w-full touch-manipulation select-none items-start gap-3 px-3 py-2.5 text-left text-sm transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-secondary/80 active:bg-secondary/60",
  /** Detached menu surface (floats outside the trigger border box). */
  dropdownPanel:
    "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-border/30",
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
        <div className={cn(dashboard.cardTitle, "flex-wrap")}>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15",
              iconClassName.includes("emerald") && "bg-emerald-500/15",
              iconClassName.includes("sky") && "bg-sky-500/15",
              iconClassName.includes("orange") && "bg-orange-500/15",
              iconClassName.includes("violet") && "bg-violet-500/15",
              iconClassName.includes("amber") && "bg-amber-500/15",
              iconClassName.includes("yellow") && "bg-amber-500/15",
              iconClassName.includes("teal") && "bg-teal-500/15",
              iconClassName.includes("rose") && "bg-rose-500/15",
              iconClassName.includes("fuchsia") && "bg-fuchsia-500/15"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
          </span>
          <span className="min-w-0">{title}</span>
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
