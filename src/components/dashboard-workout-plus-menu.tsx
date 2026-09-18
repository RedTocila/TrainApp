"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

/** Edit day’s sessions — add or remove warm-up, main, and stretching in one place. */
export function DashboardWorkoutPlusMenu({
  onEdit,
  className,
  light = false,
}: {
  onEdit: () => void;
  className?: string;
  /** Lighter styling for photo backgrounds. */
  light?: boolean;
}) {
  const platform = usePlatformCopy();

  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "!h-8 !w-8 rounded-full shadow-sm",
          light
            ? "border border-white/35 bg-black/25 text-white hover:bg-black/40 hover:text-white"
            : "border border-primary/30 bg-primary/10 text-primary shadow-primary/5 hover:border-primary/40 hover:bg-primary/15"
        )}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onEdit();
        }}
        aria-label={platform.workout.editDayWorkoutsAria}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
