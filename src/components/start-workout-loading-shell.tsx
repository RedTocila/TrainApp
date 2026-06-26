"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StartWorkoutLoadingShell({
  isLoading,
  children,
  className,
  rounded = "rounded-full",
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "relative items-center justify-center",
        className?.includes("w-full") ? "flex w-full" : "inline-flex",
        isLoading && "p-[3px]",
        className
      )}
    >
      {isLoading ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 border-2 border-primary/20 border-t-primary animate-spin",
            rounded
          )}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative",
          className?.includes("w-full") && "w-full",
          isLoading && "opacity-75"
        )}
      >
        {children}
      </div>
    </div>
  );
}
