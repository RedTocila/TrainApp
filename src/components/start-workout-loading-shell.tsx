"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StartWorkoutLoadingShell({
  isLoading,
  children,
  className,
  ring = "auto",
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  /** Spinner ring — only used for square icon buttons (`ring={true}`). */
  ring?: boolean | "auto";
}) {
  const isFullWidth = className?.includes("w-full");
  const showRing = ring === true && isLoading && !isFullWidth;

  return (
    <div
      className={cn(
        "relative items-center justify-center",
        isFullWidth ? "flex w-full" : "inline-flex",
        className
      )}
    >
      {showRing ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="h-full w-full min-h-9 min-w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </span>
      ) : null}
      <div
        className={cn(
          "relative z-[1]",
          className?.includes("w-full") && "w-full",
          isLoading &&
            !showRing &&
            "[&_button]:shadow-none [&_button]:transition-opacity"
        )}
      >
        {children}
      </div>
    </div>
  );
}
