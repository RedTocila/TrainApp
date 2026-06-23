"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "segmented";
  className?: string;
}) {
  const { theme, setTheme } = useTheme();

  if (variant === "segmented") {
    return (
      <div className={cn("flex gap-2", className)}>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
            theme === "dark"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary"
          )}
        >
          <Moon className="h-4 w-4" />
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
            theme === "light"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary"
          )}
        >
          <Sun className="h-4 w-4" />
          Light
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
