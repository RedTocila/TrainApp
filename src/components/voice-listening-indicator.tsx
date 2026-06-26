"use client";

import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function VoiceWave({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-5 items-center justify-center gap-[3px]", className)}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="voice-wave-bar w-[3px] rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function VoiceListeningIndicator({
  label,
  stopLabel,
  onStop,
}: {
  label: string;
  stopLabel: string;
  onStop: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <VoiceWave />
        <span className="truncate text-sm font-medium text-primary">{label}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStop}
        className="h-8 shrink-0 gap-1.5 rounded-full border-primary/40 bg-background/80 px-3 text-xs font-semibold hover:bg-background"
      >
        <Square className="h-3 w-3 fill-current" aria-hidden />
        {stopLabel}
      </Button>
    </div>
  );
}
