"use client";

import { Moon, Sun } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  variant = "switch",
  className,
}: {
  /** @deprecated Only used in Appearance settings. Use variant="switch". */
  variant?: "icon" | "segmented" | "switch";
  className?: string;
}) {
  const platform = usePlatformCopy();
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  if (variant === "segmented") {
    return (
      <div className={cn("flex gap-2", className)}>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "flex h-[var(--control-height)] flex-1 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
            theme === "dark"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary"
          )}
        >
          <Moon className="h-4 w-4" />
          {platform.settings.darkMode}
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "flex h-[var(--control-height)] flex-1 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
            theme === "light"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary"
          )}
        >
          <Sun className="h-4 w-4" />
          {platform.settings.lightMode}
        </button>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => setTheme(isLight ? "dark" : "light")}
        aria-label={isLight ? platform.settings.switchToDark : platform.settings.switchToLight}
        className={cn(
          "inline-flex h-[var(--control-height)] w-[var(--control-height)] items-center justify-center rounded-full border border-border text-muted-foreground transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-95 hover:bg-secondary hover:text-foreground",
          className
        )}
      >
        {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {isLight ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-violet-400" />
        )}
        <span>{isLight ? platform.settings.lightMode : platform.settings.darkMode}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={isLight ? platform.settings.switchToDark : platform.settings.switchToLight}
        onClick={() => setTheme(isLight ? "dark" : "light")}
        className={cn(
          "relative inline-flex h-[var(--control-height)] w-[4.75rem] shrink-0 items-center rounded-full border transition-colors",
          isLight
            ? "border-primary/40 bg-primary/15"
            : "border-border bg-secondary"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-8 w-8 rounded-full bg-foreground shadow-sm transition-transform",
            isLight ? "translate-x-[2.35rem]" : "translate-x-1.5"
          )}
        />
      </button>
    </div>
  );
}
