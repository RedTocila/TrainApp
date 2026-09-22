"use client";

import { useEffect, useRef, useTransition, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Sparkles,
  Target,
  ThumbsUp,
} from "lucide-react";
import { generateWeeklyCoachReportAction } from "@/lib/actions/ai-coach";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { TipCard } from "@/components/ai/tip-card";
import {
  PremiumSurface,
  PremiumSurfaceHeader,
} from "@/components/premium-surface";
import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/utils";

type ReportRow = {
  period_start: string;
  period_end: string;
  training_score: number | null;
  nutrition_score: number | null;
  consistency_score: number | null;
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
};

function isCurrentWeekReport(report: ReportRow | null): boolean {
  if (!report) return false;
  return report.period_end === formatDateKey(new Date());
}

function toReportRow(result: {
  period_start: string;
  period_end: string;
  scores: { training: number; nutrition: number; consistency: number };
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}): ReportRow {
  return {
    period_start: result.period_start,
    period_end: result.period_end,
    training_score: result.scores.training,
    nutrition_score: result.scores.nutrition,
    consistency_score: result.scores.consistency,
    summary: result.summary,
    highlights: result.highlights,
    concerns: result.concerns,
    recommendations: result.recommendations,
  };
}

export function WeeklyReportClient({ initialReport }: { initialReport: ReportRow | null }) {
  const [report, setReport] = useState<ReportRow | null>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStarted = useRef(false);

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateWeeklyCoachReportAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setReport(toReportRow(result));
    });
  };

  useEffect(() => {
    if (autoStarted.current) return;
    if (isCurrentWeekReport(initialReport)) return;
    autoStarted.current = true;
    generate();
    // Start once on open when there is no fresh report for today.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only auto-generate
  }, []);

  const showLoading = isPending && !report;

  return (
    <div className="space-y-4">
      <Button
        onClick={generate}
        disabled={isPending}
        className="h-11 w-full rounded-full text-sm font-semibold shadow-[0_0_14px_rgba(var(--primary-rgb),0.35)]"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {report ? "Refresh report" : "Generate report"}
          </>
        )}
      </Button>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {showLoading ? (
        <PremiumSurface accent="cyan" rounded="3xl" className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-400">
              <Loader2 className="h-7 w-7 animate-spin" />
            </span>
            <p className="text-sm font-medium">Generating your weekly report…</p>
            <p className="text-xs text-muted-foreground">
              Pulling in training, nutrition, and consistency
            </p>
          </div>
        </PremiumSurface>
      ) : !report ? (
        <PremiumSurface accent="cyan" rounded="3xl" className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-400">
              <Target className="h-7 w-7" />
            </span>
            <p className="text-sm text-muted-foreground">
              No report yet — tap generate above
            </p>
          </div>
        </PremiumSurface>
      ) : (
        <>
          <PremiumSurface accent="cyan" rounded="3xl" className="p-4 sm:p-5">
            <PremiumSurfaceHeader icon={Target} title="Weekly scores" accent="cyan" />
            <p className="mb-4 text-center text-xs text-muted-foreground">
              {report.period_start} → {report.period_end}
            </p>
            <div className="flex justify-around">
              <ScoreGauge
                score={report.training_score}
                label="Training"
                colorClass="text-cyan-400"
              />
              <ScoreGauge
                score={report.nutrition_score}
                label="Nutrition"
                colorClass="text-emerald-400"
              />
              <ScoreGauge
                score={report.consistency_score}
                label="Consistency"
                colorClass="text-primary"
              />
            </div>
            <p className="mt-4 rounded-2xl border border-border/50 bg-background/40 px-3 py-2.5 text-center text-sm backdrop-blur-sm">
              {report.summary}
            </p>
          </PremiumSurface>

          <div className="space-y-2.5">
            {report.highlights.map((item, i) => (
              <TipCard key={`h-${i}`} icon={ThumbsUp} title="Improving" tone="success">
                {item}
              </TipCard>
            ))}
            {report.concerns.map((item, i) => (
              <TipCard key={`c-${i}`} icon={AlertTriangle} title="Watch" tone="warning">
                {item}
              </TipCard>
            ))}
            {report.recommendations.map((item, i) => (
              <TipCard key={`r-${i}`} icon={Target} title="Next step" tone="primary">
                {item}
              </TipCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
