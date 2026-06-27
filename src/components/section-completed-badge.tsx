import { Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardStatusKind = "completed" | "missed" | "warning";

const STATUS_UI: Record<
  DashboardStatusKind,
  { ring: string; Icon: typeof Check }
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
};

export function DashboardStatusIcon({
  status,
  className,
  "aria-label": ariaLabel,
}: {
  status: DashboardStatusKind;
  className?: string;
  "aria-label"?: string;
}) {
  const { ring, Icon } = STATUS_UI[status];

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        ring,
        className
      )}
      aria-label={ariaLabel}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
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
