"use client";

import { usePlatformCopy } from "@/components/locale-provider";
import Link from "next/link";
import { OpenAiCoachChatButton } from "@/components/open-ai-coach-chat-button";
import { AiCoachChatFeatureTile } from "@/components/ai-coach-chat-feature-tile";
import {
  Camera,
  Check,
  Dumbbell,
  FileText,
  Flame,
  LineChart,
  MessageCircle,
  Salad,
  Sparkles,
  Target,
  UserRound,
  Utensils,
} from "lucide-react";
import { MacroRing } from "@/components/macro-ring";
import { ScoreGauge } from "@/components/ai/score-gauge";
import { AiFeatureTile, FlowStep } from "@/components/ai/feature-tile";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MacroGap } from "@/lib/ai/types";

type WeeklyReportPreview = {
  training_score: number | null;
  nutrition_score: number | null;
  consistency_score: number | null;
};

export function AiCoachOverviewClient({
  insightMessage,
  gap,
  workoutsThisWeek,
  daysTracked,
  report,
}: {
  insightMessage: string;
  gap: MacroGap | null;
  workoutsThisWeek: number;
  daysTracked: number;
  report: WeeklyReportPreview | null;
}) {
  const platform = usePlatformCopy();
  const hasGap = gap && gap.targets.calories > 0;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <p className="font-bold">{platform.ai.askAlex}</p>
          </div>
          <OpenAiCoachChatButton className="w-full" icon={MessageCircle}>
            {platform.ai.startChatting}
          </OpenAiCoachChatButton>
        </CardContent>
      </Card>

      {/* Plan builder flow */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="font-bold">{platform.ai.buildPlan}</p>
          </div>
          <div className="flex items-center gap-1 px-1">
            <FlowStep icon={UserRound} label={platform.ai.flowProfile} active />
            <div className="h-px flex-1 bg-border" />
            <FlowStep icon={Sparkles} label={platform.ai.flowAiBuilds} active />
            <div className="h-px flex-1 bg-border" />
            <FlowStep icon={Check} label={platform.ai.flowApply} active />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/ai/plans/workout"
              className={buttonVariants({ variant: "secondary", className: "h-11" })}
            >
              <Dumbbell className="h-4 w-4" />
              {platform.trainTabs.workout}
            </Link>
            <Link
              href="/dashboard/ai/plans/nutrition"
              className={buttonVariants({ variant: "secondary", className: "h-11" })}
            >
              <Salad className="h-4 w-4" />
              {platform.trainTabs.nutrition}
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Today snapshot */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <p className="font-bold">{platform.ai.today}</p>
          </div>

          {hasGap ? (
            <div className="grid grid-cols-4 gap-1">
              <MacroRing
                size="sm"
                value={gap.consumed.calories}
                target={gap.targets.calories}
                label={platform.ai.cal}
                icon={Flame}
                accentClass="text-orange-400"
                ringClass="text-orange-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.protein}
                target={gap.targets.protein}
                label={platform.ai.protein}
                icon={Utensils}
                accentClass="text-blue-400"
                ringClass="text-blue-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.carbs}
                target={gap.targets.carbs}
                label={platform.ai.carbs}
                icon={Salad}
                accentClass="text-amber-400"
                ringClass="text-amber-400"
              />
              <MacroRing
                size="sm"
                value={gap.consumed.fat}
                target={gap.targets.fat}
                label={platform.ai.fat}
                icon={Flame}
                accentClass="text-rose-400"
                ringClass="text-rose-400"
              />
            </div>
          ) : (
            <p className="rounded-lg bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {platform.ai.logMealsForRings}
            </p>
          )}

          <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium">{insightMessage}</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
              <p className="text-lg font-black">{workoutsThisWeek}</p>
              <p className="text-[10px] text-muted-foreground">{platform.ai.workoutsThisWeek}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
              <p className="text-lg font-black">{daysTracked}/7</p>
              <p className="text-[10px] text-muted-foreground">{platform.ai.daysTracked}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly scores */}
      {report && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <p className="font-bold">{platform.ai.weeklyScores}</p>
              </div>
              <Link href="/dashboard/ai/reports" className="text-xs font-medium text-primary">
                {platform.ai.fullReport}
              </Link>
            </div>
            <div className="flex justify-around">
              <ScoreGauge score={report.training_score} label={platform.ai.training} colorClass="text-blue-400" />
              <ScoreGauge score={report.nutrition_score} label={platform.ai.nutrition} colorClass="text-green-400" />
              <ScoreGauge
                score={report.consistency_score}
                label={platform.ai.consistency}
                colorClass="text-primary"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log with AI - visual steps */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <p className="font-bold">{platform.ai.logMealsAi}</p>
          </div>
          <div className="flex justify-between gap-2">
            <FlowStep icon={Camera} label={platform.ai.flowPhoto} active />
            <div className="mt-5 h-px flex-1 bg-border" />
            <FlowStep icon={Sparkles} label={platform.ai.flowEstimate} active />
            <div className="mt-5 h-px flex-1 bg-border" />
            <FlowStep icon={Check} label={platform.ai.flowConfirm} active />
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
            {platform.ai.goDashboard}
          </Link>
        </CardContent>
      </Card>

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AiCoachChatFeatureTile icon={MessageCircle} label={platform.ai.askCoach} />
        <AiFeatureTile href="/dashboard/ai/meal-suggestions" icon={Salad} label={platform.ai.mealIdeas} />
        <AiFeatureTile
          href="/dashboard/ai/recommendations"
          icon={Sparkles}
          label={platform.ai.tips}
          accentClass="text-amber-400"
          bgClass="bg-amber-500/10"
        />
        <AiFeatureTile
          href="/dashboard/ai/predictions"
          icon={LineChart}
          label={platform.ai.progress}
          accentClass="text-blue-400"
          bgClass="bg-blue-500/10"
        />
      </div>
    </div>
  );
}
