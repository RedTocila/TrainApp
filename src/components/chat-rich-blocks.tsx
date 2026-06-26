"use client";

import {
  Activity,
  AlertTriangle,
  Apple,
  Calendar,
  Dumbbell,
  Flame,
  LineChart,
  Salad,
  Scale,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { StatBar } from "@/components/ai/stat-bar";
import { TipCard } from "@/components/ai/tip-card";
import { MacroRing } from "@/components/macro-ring";
import { WeightChart } from "@/components/weight-chart";
import { Card, CardContent } from "@/components/ui/card";
import type { CoachChatRichBlock } from "@/lib/ai/coach-chat-block-types";
import { macroExceededDailyUpperLimit } from "@/lib/macro-targets";
import { cn } from "@/lib/utils";

const TIP_ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  apple: Apple,
  calendar: Calendar,
  activity: Activity,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
};

const STAT_BAR_ICONS: Record<string, LucideIcon> = {
  workouts: Dumbbell,
  meals: Salad,
  protein: Utensils,
};

function MacroRingsBlock({ block }: { block: Extract<CoachChatRichBlock, { type: "macro_rings" }> }) {
  const { gap } = block;
  if (gap.targets.calories <= 0) {
    return (
      <p className="rounded-lg bg-secondary/40 px-3 py-4 text-center text-xs text-muted-foreground">
        Log meals today to see your macro rings.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      <MacroRing
        size="sm"
        value={gap.consumed.calories}
        target={gap.targets.calories}
        label="Cal"
        icon={Flame}
        accentClass="text-orange-400"
        ringClass="text-orange-400"
        exceededTolerance={macroExceededDailyUpperLimit(
          gap.consumed.calories,
          gap.targets.calories,
          "calories"
        )}
      />
      <MacroRing
        size="sm"
        value={gap.consumed.protein}
        target={gap.targets.protein}
        label="Protein"
        icon={Utensils}
        accentClass="text-blue-400"
        ringClass="text-blue-400"
        exceededTolerance={macroExceededDailyUpperLimit(
          gap.consumed.protein,
          gap.targets.protein,
          "protein"
        )}
      />
      <MacroRing
        size="sm"
        value={gap.consumed.carbs}
        target={gap.targets.carbs}
        label="Carbs"
        icon={Salad}
        accentClass="text-amber-400"
        ringClass="text-amber-400"
        exceededTolerance={macroExceededDailyUpperLimit(
          gap.consumed.carbs,
          gap.targets.carbs,
          "carbs"
        )}
      />
      <MacroRing
        size="sm"
        value={gap.consumed.fat}
        target={gap.targets.fat}
        label="Fat"
        icon={Flame}
        accentClass="text-rose-400"
        ringClass="text-rose-400"
        exceededTolerance={macroExceededDailyUpperLimit(
          gap.consumed.fat,
          gap.targets.fat,
          "fat"
        )}
      />
    </div>
  );
}

function WeeklyReportBlock({
  block,
}: {
  block: Extract<CoachChatRichBlock, { type: "weekly_report" }>;
}) {
  const { report } = block;
  return (
    <div className="space-y-2">
      <Card className="border-border/60 bg-background/50">
        <CardContent className="space-y-4 p-3">
          <div className="flex justify-around">
            <ScoreGauge
              score={report.scores.training}
              label="Training"
              colorClass="text-blue-400"
              size="sm"
            />
            <ScoreGauge
              score={report.scores.nutrition}
              label="Nutrition"
              colorClass="text-green-400"
              size="sm"
            />
            <ScoreGauge
              score={report.scores.consistency}
              label="Consistency"
              colorClass="text-primary"
              size="sm"
            />
          </div>
          <p className="rounded-lg bg-secondary/40 px-3 py-2 text-center text-xs">{report.summary}</p>
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
    </div>
  );
}

function WeightTrendBlock({
  block,
}: {
  block: Extract<CoachChatRichBlock, { type: "weight_trend" }>;
}) {
  const { prediction, weightHistory, startWeightKg, startDate } = block;
  const trendingUp = (prediction.weekly_change_kg ?? 0) > 0;
  const TrendIcon = trendingUp ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-2">
      <Card className="border-border/60 bg-background/50">
        <CardContent className="space-y-3 p-3">
          {prediction.goal_progress_pct != null && (
            <div className="flex justify-center">
              <ScoreGauge
                score={prediction.goal_progress_pct}
                label="Goal progress"
                colorClass="text-primary"
                size="md"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {prediction.current_weight_kg != null && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2.5">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-base font-black">{prediction.current_weight_kg} kg</p>
                  <p className="text-[10px] text-muted-foreground">Current</p>
                </div>
              </div>
            )}
            {prediction.weekly_change_kg != null && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2.5">
                <TrendIcon
                  className={cn("h-4 w-4", trendingUp ? "text-amber-400" : "text-green-400")}
                />
                <div>
                  <p className="text-base font-black">
                    {prediction.weekly_change_kg > 0 ? "+" : ""}
                    {prediction.weekly_change_kg}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kg / week</p>
                </div>
              </div>
            )}
            {prediction.estimated_goal_date && (
              <div className="col-span-2 flex items-center gap-2 rounded-xl bg-primary/10 p-2.5">
                <Target className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-bold">{prediction.estimated_goal_date}</p>
                  <p className="text-[10px] text-muted-foreground">Estimated goal date</p>
                </div>
              </div>
            )}
          </div>
          {prediction.summary && (
            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
              {prediction.summary}
            </p>
          )}
        </CardContent>
      </Card>
      {weightHistory.length > 1 && (
        <Card className="border-border/60 bg-background/50">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold">Weight trend</p>
            </div>
            <WeightChart
              entries={weightHistory}
              startWeightKg={startWeightKg}
              startDate={startDate}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MealSuggestionsBlock({
  block,
}: {
  block: Extract<CoachChatRichBlock, { type: "meal_suggestions" }>;
}) {
  const { headline, suggestions } = block;
  return (
    <div className="space-y-2">
      <p
        className={cn(
          "rounded-lg px-3 py-2 text-center text-xs font-medium",
          block.gap.overTolerance ? "bg-orange-500/10 text-orange-300" : "bg-primary/5"
        )}
      >
        {headline}
      </p>
      {suggestions.map((s, i) => (
        <Card key={i} className="border-border/60 bg-background/50">
          <CardContent className="flex gap-2.5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Salad className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{s.title}</p>
              {s.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</p>
              )}
              {(s.calories > 0 || s.protein_g > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.calories > 0 && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                      {s.calories} cal
                    </span>
                  )}
                  {s.protein_g > 0 && (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      {s.protein_g}g protein
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RichBlock({ block }: { block: CoachChatRichBlock }) {
  switch (block.type) {
    case "section_header":
      return (
        <div className="pt-1">
          <p className="text-xs font-bold text-foreground">{block.title}</p>
          {block.subtitle && (
            <p className="text-[10px] text-muted-foreground">{block.subtitle}</p>
          )}
        </div>
      );
    case "macro_rings":
      return <MacroRingsBlock block={block} />;
    case "insight_banner":
      return (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium",
            block.tone === "warning"
              ? "bg-orange-500/10 text-orange-300"
              : block.tone === "success"
                ? "bg-green-500/10 text-green-300"
                : "bg-primary/5"
          )}
        >
          {block.text}
        </p>
      );
    case "stat_tiles":
      return (
        <div className="grid grid-cols-2 gap-2">
          {block.tiles.map((tile, i) => (
            <div key={i} className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
              <p className="text-lg font-black">{tile.value}</p>
              <p className="text-[10px] text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>
      );
    case "score_gauges":
      return (
        <div className="flex justify-around rounded-xl border border-border/60 bg-background/50 p-3">
          {block.gauges.map((gauge, i) => (
            <ScoreGauge
              key={i}
              score={gauge.score}
              label={gauge.label}
              colorClass={gauge.colorClass}
              size="sm"
            />
          ))}
        </div>
      );
    case "stat_bars":
      return (
        <div className="space-y-2">
          {block.bars.map((bar, i) => {
            const iconKey =
              bar.label.toLowerCase().includes("workout")
                ? "workouts"
                : bar.label.toLowerCase().includes("meal") || bar.label.toLowerCase().includes("tracked")
                  ? "meals"
                  : "protein";
            return (
              <StatBar
                key={i}
                label={bar.label}
                value={bar.value}
                max={bar.max}
                unit={bar.unit}
                accentClass={bar.accentClass}
                icon={STAT_BAR_ICONS[iconKey] ?? Activity}
              />
            );
          })}
        </div>
      );
    case "tip_cards":
      return (
        <div className="space-y-2">
          {block.tips.map((tip, i) => {
            const Icon = TIP_ICONS[tip.icon] ?? Sparkles;
            return (
              <TipCard key={i} icon={Icon} title={tip.title} tone={tip.tone}>
                {tip.body}
              </TipCard>
            );
          })}
        </div>
      );
    case "weight_trend":
      return <WeightTrendBlock block={block} />;
    case "meal_suggestions":
      return <MealSuggestionsBlock block={block} />;
    case "weekly_report":
      return <WeeklyReportBlock block={block} />;
    default:
      return null;
  }
}

export function ChatRichBlocks({ blocks }: { blocks: CoachChatRichBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-primary/20 bg-background/80 p-3">
      {blocks.map((block, i) => (
        <RichBlock key={i} block={block} />
      ))}
    </div>
  );
}
