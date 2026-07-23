import { Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardStatusKind = "completed" | "missed" | "warning" | "pending";

const STATUS_UI: Record<
  DashboardStatusKind,
  { ring: string; Icon: typeof Check | null }
> = {
  completed: {
    ring: "bg-green-500/15 text-green-400",
    Icon: Check,
  },
  missed: {
    ring: "bg-red-500/15 text-red-400",
    Icon: X,
  },
  warning: {
    ring: "bg-amber-500/15 text-amber-400",
    Icon: TriangleAlert,
  },
  pending: {
    ring: "border-2 border-muted-foreground/40 bg-transparent text-muted-foreground/50",
    Icon: null,
  },
};

/** Green check when done; red X after the day ends; empty circle while the day is still open. */
export function dashboardCompletionStatus(
  completed: boolean,
  dayEnded: boolean
): Exclude<DashboardStatusKind, "warning"> {
  if (completed) return "completed";
  if (dayEnded) return "missed";
  return "pending";
}

export function DashboardStatusIcon({
  status,
  className,
  tone = "light",
  "aria-label": ariaLabel,
}: {
  status: DashboardStatusKind;
  className?: string;
  /** Use on dark gradient cards so the empty circle stays visible. */
  tone?: "light" | "dark";
  "aria-label"?: string;
}) {
  const { ring, Icon } = STATUS_UI[status];
  const pendingTone =
    status === "pending" && tone === "dark"
      ? "border-white/35 text-white/55"
      : undefined;

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        ring,
        pendingTone,
        className
      )}
      aria-label={ariaLabel}
    >
      {Icon ? (
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-current opacity-80"
          aria-hidden
        />
      )}
    </span>
  );
}

export function SectionCompletedBadge() {
  return (
    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
      Completed
    </span>
  );
}

export function sectionCompletedCardClass(_completed: boolean) {
  return "";
}

export function DashboardStatusCheck({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <DashboardStatusIcon
      status="completed"
      className={className}
      aria-label={ariaLabel}
    />
  );
}
