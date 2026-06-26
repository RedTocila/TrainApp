"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Gift, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ReferralProgramCopy } from "@/lib/referral-program-copy";
import type { ReferralDashboardData } from "@/lib/actions/referrals";
import { cn } from "@/lib/utils";
import { buildReferralsHref } from "@/lib/referrals-nav";

function getMilestoneProgress(
  qualifiedCount: number,
  milestones: readonly { count: number; label: string }[]
) {
  const maxCount = milestones[milestones.length - 1]?.count ?? 25;
  const next = milestones.find((m) => qualifiedCount < m.count) ?? null;
  const overallPercent = (qualifiedCount / maxCount) * 100;

  return { maxCount, next, overallPercent };
}

function getDefaultMilestoneIndex(
  milestones: readonly { count: number }[],
  nextMilestoneCount: number | null
) {
  if (nextMilestoneCount == null) return milestones.length - 1;
  const index = milestones.findIndex((m) => m.count === nextMilestoneCount);
  return index >= 0 ? index : 0;
}

export function ReferralProgram({
  data,
  copy,
  compact = false,
}: {
  data: ReferralDashboardData;
  copy: ReferralProgramCopy;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const referralsHref = buildReferralsHref(pathname);
  const defaultIndex = useMemo(
    () => getDefaultMilestoneIndex(copy.milestoneRewards, data.nextMilestoneCount),
    [copy.milestoneRewards, data.nextMilestoneCount]
  );
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

  const { maxCount, next, overallPercent } = getMilestoneProgress(
    data.qualifiedCount,
    copy.milestoneRewards
  );

  const selected = copy.milestoneRewards[selectedIndex];
  const earned = data.qualifiedCount >= selected.count;
  const isNext = selected.count === data.nextMilestoneCount;
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < copy.milestoneRewards.length - 1;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={cn("font-black", compact ? "text-base" : "text-lg")}>
              {copy.title}
            </h2>
            {data.founderBadge && (
              <Badge className="bg-amber-500/15 text-amber-300">{copy.founderBadge}</Badge>
            )}
          </div>
          {!compact && <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>}
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">{data.qualifiedCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {copy.successfulReferrals}
            </p>
          </div>
          {data.pendingCount > 0 && (
            <div>
              <p className="text-2xl font-black tabular-nums text-muted-foreground">
                {data.pendingCount}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {copy.pendingReferrals}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {copy.yourLink}
        </p>
        <div className="flex gap-2">
          <Input readOnly value={data.referralLink} className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? copy.copied : copy.copyLink}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3 sm:p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {copy.rewardsTitle}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {data.qualifiedCount}
              <span className="text-muted-foreground"> / {maxCount}</span>
            </p>
          </div>
          {next ? (
            <p className="text-right text-xs text-muted-foreground">{copy.nextMilestoneText}</p>
          ) : (
            <p className="text-right text-xs text-primary">{copy.allMilestonesUnlocked}</p>
          )}
        </div>

        <Progress value={overallPercent} className={cn(compact ? "h-2" : "h-3")} />

        <div className={cn("relative h-8", compact && "h-6")}>
          {copy.milestoneRewards.map((milestone, index) => {
            const milestoneEarned = data.qualifiedCount >= milestone.count;
            const milestoneIsNext = milestone.count === data.nextMilestoneCount;
            const isSelected = index === selectedIndex;
            const left = (milestone.count / maxCount) * 100;

            return (
              <button
                key={milestone.count}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${left}%` }}
                aria-label={milestone.atReferrals}
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border font-bold transition-all",
                    compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[10px]",
                    isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    milestoneEarned
                      ? "border-primary bg-primary text-primary-foreground"
                      : milestoneIsNext
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {milestoneEarned ? (
                    <Check className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
                  ) : (
                    milestone.count
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!canGoPrev}
              onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              aria-label={copy.previousReward}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                {earned ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {copy.unlocked}
                  </Badge>
                ) : isNext ? (
                  <Badge className="bg-primary/15 text-[10px] text-primary">{copy.nextReward}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {copy.locked}
                  </Badge>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {selectedIndex + 1} / {copy.milestoneRewards.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{selected.atReferrals}</p>
              <p className="mt-0.5 text-sm font-semibold">{selected.label}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!canGoNext}
              onClick={() =>
                setSelectedIndex((i) => Math.min(copy.milestoneRewards.length - 1, i + 1))
              }
              aria-label={copy.nextRewardNav}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!compact && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <Users className="h-4 w-4 text-primary" />
              {copy.howItWorksTitle}
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {copy.howItWorks.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {compact && (
        <Link
          href={referralsHref}
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-full gap-2" })}
        >
          <Gift className="h-4 w-4" />
          {copy.viewProgram}
        </Link>
      )}
    </div>
  );
}
