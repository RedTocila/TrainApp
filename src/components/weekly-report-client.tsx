"use client";

import { useTransition, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

export function WeeklyReportClient({ initialReport }: { initialReport: ReportRow | null }) {
  const [report, setReport] = useState<ReportRow | null>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateWeeklyCoachReportAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setReport({
        period_start: result.period_start,
        period_end: result.period_end,
        training_score: result.scores.training,
        nutrition_score: result.scores.nutrition,
        consistency_score: result.scores.consistency,
        summary: result.summary,
        highlights: result.highlights,
        concerns: result.concerns,
        recommendations: result.recommendations,
      });
    });
  };

  return (
    <div className="space-y-4">
      <Button onClick={generate} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate report
          </>
        )}
      </Button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No report yet — tap generate above</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-4">
              <p className="text-center text-xs text-muted-foreground">
                {report.period_start} → {report.period_end}
              </p>
              <div className="flex justify-around">
                <ScoreGauge
                  score={report.training_score}
                  label="Training"
                  colorClass="text-blue-400"
                />
                <ScoreGauge
                  score={report.nutrition_score}
                  label="Nutrition"
                  colorClass="text-green-400"
                />
                <ScoreGauge
                  score={report.consistency_score}
                  label="Consistency"
                  colorClass="text-primary"
                />
              </div>
              <p className="rounded-lg bg-secondary/40 px-3 py-2 text-center text-sm">{report.summary}</p>
            </CardContent>
          </Card>

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
        </>
      )}
    </div>
  );
}
