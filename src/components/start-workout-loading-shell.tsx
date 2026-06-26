"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StartWorkoutLoadingShell({
  isLoading,
  children,
  className,
  ringInset = "-inset-1",
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  ringInset?: string;
}) {
  return (
    <div className={cn("relative inline-flex", className)}>
      {isLoading ? (
        <span
          className={cn(
            "start-workout-loading-ring pointer-events-none absolute rounded-full",
            ringInset
          )}
          aria-hidden
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
