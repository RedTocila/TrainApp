"use client";

import { useTheme } from "@/components/theme-provider";
import { ACCENT_COLORS } from "@/lib/theme-colors";
import { cn } from "@/lib/utils";

export function AccentColorPicker({ className }: { className?: string }) {
  const { accentColor, setAccentColor } = useTheme();

  return (
    <div className={cn("grid grid-cols-4 gap-2 sm:grid-cols-4", className)}>
      {ACCENT_COLORS.map((color) => {
        const selected = accentColor === color.id;
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => setAccentColor(color.id)}
            aria-label={`${color.label} theme`}
            aria-pressed={selected}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            <span
              className={cn(
                "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card",
                selected ? "ring-primary" : "ring-transparent"
              )}
              style={{ backgroundColor: color.swatch }}
            />
            {color.label}
          </button>
        );
      })}
    </div>
  );
}
