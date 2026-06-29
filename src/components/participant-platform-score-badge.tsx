"use client";

import { useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { Progress } from "@/components/ui/progress";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  PLATFORM_SCORE_WEIGHTS,
  platformScoreTone,
  type PlatformScoreBreakdown,
} from "@/lib/platform-engagement-score";
import { cn } from "@/lib/utils";

function scoreBarColor(score: number): string {
  const tone = platformScoreTone(score);
  if (tone === "high") return "bg-emerald-500";
  if (tone === "mid") return "bg-amber-500";
  return "bg-red-500";
}

function BreakdownRow({
  label,
  score,
  weightLabel,
  compact = false,
}: {
  label: string;
  score?: number;
  weightLabel?: string;
  compact?: boolean;
}) {
  const displayScore = score ?? "—";

  return (
    <div className={cn("space-y-1", compact ? "text-[11px]" : "text-sm")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {label}
          {weightLabel ? (
            <span className="text-muted-foreground/70"> · {weightLabel}</span>
          ) : null}
        </span>
        <span className="font-bold tabular-nums text-foreground">
          {typeof displayScore === "number" ? `${displayScore}/100` : displayScore}
        </span>
      </div>
      {typeof score === "number" ? (
        <Progress value={score} className="h-1.5" indicatorClassName={scoreBarColor(score)} />
      ) : null}
    </div>
  );
}

function BreakdownPanel({
  score,
  breakdown,
  compact = false,
}: {
  score: number;
  breakdown?: PlatformScoreBreakdown;
  compact?: boolean;
}) {
  const copy = usePlatformCopy().platformScore;
  const nutritionWeight = `${Math.round(PLATFORM_SCORE_WEIGHTS.nutrition * 100)}%`;
  const workoutWeight = `${Math.round(PLATFORM_SCORE_WEIGHTS.workout * 100)}%`;
  const lifestyleWeight = `${Math.round(PLATFORM_SCORE_WEIGHTS.lifestyle * 100)}%`;

  return (
    <div className={cn("space-y-2.5", compact ? "min-w-[14rem]" : "space-y-4")}>
      {!compact ? (
        <p className="text-sm text-muted-foreground">{copy.dialogIntro}</p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">{copy.hoverIntro}</p>
      )}

      <BreakdownRow
        label={copy.nutrition}
        score={breakdown?.nutrition}
        weightLabel={nutritionWeight}
        compact={compact}
      />
      <BreakdownRow
        label={copy.workout}
        score={breakdown?.workout}
        weightLabel={workoutWeight}
        compact={compact}
      />
      <BreakdownRow
        label={copy.lifestyle}
        score={breakdown?.lifestyle}
        weightLabel={lifestyleWeight}
        compact={compact}
      />

      {breakdown && !compact ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.lifestyleDetailTitle}
          </p>
          <BreakdownRow label={copy.habits} score={breakdown.habits} compact />
          <BreakdownRow label={copy.water} score={breakdown.water} compact />
        </div>
      ) : null}

      {!compact ? (
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
          <span className="font-semibold">{copy.overall}</span>
          <span className="text-lg font-black tabular-nums">{score}/100</span>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{copy.clickForDetails}</p>
      )}
    </div>
  );
}

export function ParticipantPlatformScoreBadge({
  score,
  breakdown,
  className,
}: {
  score: number;
  breakdown?: PlatformScoreBreakdown;
  className?: string;
}) {
  const copy = usePlatformCopy().platformScore;
  const [hoverOpen, setHoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const tone = platformScoreTone(score);

  return (
    <>
      <span
        className="relative inline-flex"
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
      >
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
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none transition-opacity hover:opacity-90",
            tone === "high" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
            tone === "mid" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
            tone === "low" && "border-red-500/40 bg-red-500/10 text-red-400",
            className
          )}
        >
          {score}/100
        </button>

        {hoverOpen && !dialogOpen ? (
          <div
            role="tooltip"
            className="absolute bottom-full right-0 z-50 mb-2 w-max max-w-[16rem] rounded-xl border border-border bg-card p-3 text-foreground shadow-lg"
          >
            <p className="mb-2 text-xs font-bold text-foreground">{copy.hoverTitle}</p>
            <BreakdownPanel score={score} breakdown={breakdown} compact />
          </div>
        ) : null}
      </span>

      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={copy.dialogTitle}
        description={copy.dialogDescription.replace("{score}", String(score))}
        maxWidth="max-w-md"
      >
        <div className="px-5 pb-5">
          <BreakdownPanel score={score} breakdown={breakdown} />
        </div>
      </AppDialog>
    </>
  );
}
