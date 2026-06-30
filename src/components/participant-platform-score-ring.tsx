"use client";

import { useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  platformScoreTone,
  type PlatformScoreBreakdown,
} from "@/lib/platform-engagement-score";
import { cn } from "@/lib/utils";

function scoreColorClass(score: number): string {
  const tone = platformScoreTone(score);
  if (tone === "high") return "text-emerald-500";
  if (tone === "mid") return "text-amber-500";
  return "text-red-500";
}

function BreakdownRow({
  label,
  score,
}: {
  label: string;
  score?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">
        {typeof score === "number" ? `${score}%` : "—"}
      </span>
    </div>
  );
}

export function ParticipantPlatformScoreRing({
  score,
  breakdown,
  className,
}: {
  score: number;
  breakdown?: PlatformScoreBreakdown;
  className?: string;
}) {
  const copy = usePlatformCopy().platformScore;
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={copy.openDetails.replace("{score}", String(score))}
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDialogOpen(true);
        }}
        className={cn("inline-flex shrink-0", className)}
      >
        <ScoreGauge
          score={score}
          label=""
          size="sm"
          suffix="%"
          colorClass={scoreColorClass(score)}
        />
      </button>

      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={copy.dialogTitle}
        description={copy.dialogDescription.replace("{score}", String(score))}
        maxWidth="max-w-md"
      >
        <div className="space-y-3 px-5 pb-5">
          <div className="flex justify-center">
            <ScoreGauge
              score={score}
              label="Overall score"
              size="md"
              suffix="%"
              colorClass={scoreColorClass(score)}
            />
          </div>
          <BreakdownRow label={copy.nutrition} score={breakdown?.nutrition} />
          <BreakdownRow label={copy.workout} score={breakdown?.workout} />
          <BreakdownRow label={copy.lifestyle} score={breakdown?.lifestyle} />
          {breakdown ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <BreakdownRow label={copy.habits} score={breakdown.habits} />
              <BreakdownRow label={copy.water} score={breakdown.water} />
            </div>
          ) : null}
        </div>
      </AppDialog>
    </>
  );
}
