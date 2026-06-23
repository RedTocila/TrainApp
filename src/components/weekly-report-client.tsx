"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { generateWeeklyCoachReportAction } from "@/lib/actions/ai-coach";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

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
      <Button onClick={generate} disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate weekly report
          </>
        )}
      </Button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!report ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No report yet. Generate your first weekly coach report card.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Week {report.period_start} — {report.period_end}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Score label="Training" value={report.training_score} />
                <Score label="Nutrition" value={report.nutrition_score} />
                <Score label="Consistency" value={report.consistency_score} />
              </div>
              <p className="text-sm">{report.summary}</p>
            </CardContent>
          </Card>

          <ReportSection title="What's improving" items={report.highlights} tone="green" />
          <ReportSection title="What to watch" items={report.concerns} tone="amber" />
          <ReportSection title="Next week actions" items={report.recommendations} tone="primary" />
        </>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value ?? "—"}</p>
    </div>
  );
}

function ReportSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "primary";
}) {
  if (!items?.length) return null;
  const border =
    tone === "green"
      ? "border-green-500/30"
      : tone === "amber"
        ? "border-amber-500/30"
        : "border-primary/30";

  return (
    <Card className={border}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span>•</span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
