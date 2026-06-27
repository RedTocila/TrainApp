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
  /** Show a spinner ring around the control. `auto` = ring unless full-width. */
  ring?: boolean | "auto";
}) {
  const isFullWidth = className?.includes("w-full");
  const showRing =
    ring === "auto" ? isLoading && !isFullWidth : ring && isLoading;

  return (
    <div
      className={cn(
        "relative items-center justify-center",
        className?.includes("w-full") ? "flex w-full" : "inline-flex",
        className
      )}
    >
      {showRing ? (
        <span
          className="pointer-events-none absolute -inset-0.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          className?.includes("w-full") && "w-full",
          isLoading && !showRing && "opacity-75"
        )}
      >
        {children}
      </div>
    </div>
  );
}
