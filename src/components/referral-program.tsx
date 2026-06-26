"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Crown,
  Gift,
  Link2,
  Medal,
  Share2,
  Sparkles,
  Star,
  Target,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ReferralProgramCopy } from "@/lib/referral-program-copy";
import type { ReferralDashboardData } from "@/lib/actions/referrals";
import { cn } from "@/lib/utils";
import { buildReferralsHref } from "@/lib/referrals-nav";

const FLOW_ICONS = [Link2, UserPlus, Gift] as const;

const MILESTONE_ICONS: Record<number, LucideIcon> = {
  1: Calendar,
  3: CalendarDays,
  5: Medal,
  10: Star,
  15: Sparkles,
  25: Crown,
};

function getMilestoneProgress(
  qualifiedCount: number,
  milestones: readonly { count: number; label: string }[]
) {
  const maxCount = milestones[milestones.length - 1]?.count ?? 25;
  const next = milestones.find((m) => qualifiedCount < m.count) ?? null;
  const overallPercent = (qualifiedCount / maxCount) * 100;

  let nextPercent = 100;
  if (next) {
    const prevCount =
      [...milestones].reverse().find((m) => m.count < next.count)?.count ?? 0;
    const span = next.count - prevCount;
    nextPercent = span > 0 ? ((qualifiedCount - prevCount) / span) * 100 : 0;
  }

  return { maxCount, next, overallPercent, nextPercent };
}

function ProgressRing({
  percent,
  size = 72,
  stroke = 6,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  muted,
  compact,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  muted?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border bg-secondary/20 text-center",
        compact ? "p-2" : "p-3"
      )}
    >
      <div
        className={cn(
          "mb-1.5 flex items-center justify-center rounded-lg bg-primary/10",
          compact ? "h-7 w-7" : "h-8 w-8"
        )}
      >
        <Icon className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </div>
      <p
        className={cn(
          "font-black tabular-nums",
          compact ? "text-lg" : "text-2xl",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
        {label}
      </p>
    </div>
  );
}

function MilestoneTile({
  count,
  label,
  earned,
  isNext,
  compact,
}: {
  count: number;
  label: string;
  earned: boolean;
  isNext: boolean;
  compact?: boolean;
}) {
  const Icon = MILESTONE_ICONS[count] ?? Gift;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-xl border p-2 text-center transition-colors sm:p-3",
        earned
          ? "border-primary/40 bg-primary/10"
          : isNext
            ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
            : "border-border bg-secondary/10 opacity-60"
      )}
    >
      {earned && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </div>
      )}
      <div
        className={cn(
          "mb-1.5 flex items-center justify-center rounded-lg",
          earned ? "bg-primary/20" : "bg-secondary/50",
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        <Icon
          className={cn(
            compact ? "h-4 w-4" : "h-4 w-4",
            earned || isNext ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <p
        className={cn(
          "font-black tabular-nums",
          compact ? "text-sm" : "text-base",
          earned || isNext ? "text-primary" : "text-muted-foreground"
        )}
      >
        {count}
      </p>
      {!compact && (
        <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
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

  const { maxCount, next, overallPercent, nextPercent } = useMemo(
    () => getMilestoneProgress(data.qualifiedCount, copy.milestoneRewards),
    [data.qualifiedCount, copy.milestoneRewards]
  );

  const remaining = next != null ? next.count - data.qualifiedCount : 0;

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
      {!compact && data.founderBadge && (
        <Badge className="gap-1 bg-amber-500/15 text-amber-300">
          <Crown className="h-3 w-3" />
          {copy.founderBadge}
        </Badge>
      )}

      <div className={cn("grid gap-2", data.pendingCount > 0 ? "grid-cols-3" : "grid-cols-2")}>
        <StatTile
          icon={UserCheck}
          value={data.qualifiedCount}
          label={copy.successfulReferrals}
          compact={compact}
        />
        {data.pendingCount > 0 && (
          <StatTile
            icon={Clock}
            value={data.pendingCount}
            label={copy.pendingReferrals}
            muted
            compact={compact}
          />
        )}
        <StatTile
          icon={Target}
          value={next ? remaining : "✓"}
          label={next ? copy.nextReward : copy.unlocked}
          compact={compact}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Share2 className="h-3.5 w-3.5" />
          {copy.yourLink}
        </div>
        <div className="flex gap-2">
          <Input readOnly value={data.referralLink} className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only">{copied ? copy.copied : copy.copyLink}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3 sm:p-4">
        <div className="flex items-center gap-4">
          <ProgressRing percent={next ? nextPercent : 100} size={compact ? 60 : 72}>
            <span className={cn("font-black tabular-nums", compact ? "text-sm" : "text-base")}>
              {data.qualifiedCount}
            </span>
            <span className="text-[9px] text-muted-foreground">/ {next?.count ?? maxCount}</span>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Gift className="h-3.5 w-3.5" />
              {copy.rewardsTitle}
            </div>
            {next ? (
              <p className="mt-1 text-sm font-semibold">{copy.nextMilestoneText}</p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-primary">{copy.allMilestonesUnlocked}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {data.qualifiedCount} / {maxCount}
            </p>
          </div>
        </div>

        <Progress value={overallPercent} className={cn(compact ? "h-2" : "h-2.5")} />

        <div className={cn("relative", compact ? "h-5" : "h-6")}>
          {copy.milestoneRewards.map((milestone) => {
            const milestoneEarned = data.qualifiedCount >= milestone.count;
            const milestoneIsNext = milestone.count === data.nextMilestoneCount;
            const left = (milestone.count / maxCount) * 100;

            return (
              <div
                key={milestone.count}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${left}%` }}
                title={milestone.label}
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border font-bold",
                    compact ? "h-3.5 w-3.5 text-[7px]" : "h-4 w-4 text-[8px]",
                    milestoneEarned
                      ? "border-primary bg-primary text-primary-foreground"
                      : milestoneIsNext
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {milestoneEarned ? (
                    <Check className={cn(compact ? "h-2 w-2" : "h-2.5 w-2.5")} />
                  ) : (
                    milestone.count
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {copy.milestoneRewards.map((milestone) => (
            <MilestoneTile
              key={milestone.count}
              count={milestone.count}
              label={milestone.label}
              earned={data.qualifiedCount >= milestone.count}
              isNext={milestone.count === data.nextMilestoneCount}
            />
          ))}
        </div>
      )}

      {!compact && (
        <div className="rounded-xl border border-dashed border-border bg-secondary/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {copy.howItWorksTitle}
          </div>
          <div className="flex items-center justify-between gap-1">
            {copy.howItWorks.map((step, index) => {
              const Icon = FLOW_ICONS[index] ?? Gift;
              return (
                <div key={step} className="contents">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-[11px] font-semibold leading-tight">{step}</p>
                  </div>
                  {index < copy.howItWorks.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
