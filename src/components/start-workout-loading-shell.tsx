"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StartWorkoutLoadingShell({
  isLoading,
  children,
  className,
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "items-center justify-center",
        className?.includes("w-full") ? "flex w-full" : "inline-flex",
        className
      )}
    >
      <div
        className={cn(
          className?.includes("w-full") && "w-full",
          isLoading && "opacity-75"
        )}
      >
        {children}
      </div>
    </div>
  );
}
