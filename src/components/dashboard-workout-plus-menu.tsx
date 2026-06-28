"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardWorkoutPlusMenu({
  onAddWorkout,
  onRemoveWorkout,
  canRemove,
  className,
}: {
  onAddWorkout: () => void;
  onRemoveWorkout: () => void;
  canRemove: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onRemoveWorkout();
          }}
          aria-label="Remove workout"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/5 hover:border-primary/40 hover:bg-primary/15"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onAddWorkout();
        }}
        aria-label="Add workout"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
