"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Award,
  Check,
  Clock,
  Coins,
  Copy,
  Gift,
  Link2,
  PiggyBank,
  Share2,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AmbassadorBadge } from "@/components/ambassador-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ReferralProgramCopy } from "@/lib/referral-program-copy";
import type { ReferralDashboardData } from "@/lib/actions/referrals";
import { cn } from "@/lib/utils";
import { buildReferralsHref } from "@/lib/referrals-nav";

const FLOW_ICONS = [Link2, UserPlus, Coins] as const;

function StatTile({
  icon: Icon,
  value,
  label,
  muted,
  compact,
  highlight,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  muted?: boolean;
  compact?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border text-center",
        highlight
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-secondary/20",
        compact ? "p-2" : "p-3"
      )}
    >
      <div
        className={cn(
          "mb-1.5 flex items-center justify-center rounded-lg",
          highlight ? "bg-primary/20" : "bg-primary/10",
          compact ? "h-7 w-7" : "h-8 w-8"
        )}
      >
        <Icon className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </div>
      <p
        className={cn(
          "font-black tabular-nums",
          compact ? "text-lg" : "text-2xl",
          muted && "text-muted-foreground",
          highlight && "text-primary"
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

export function ReferralProgram({
  data,
  copy,
  compact = false,
}: {
  data: ReferralDashboardData;
  copy: ReferralProgramCopy;
  compact?: boolean;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const pathname = usePathname();
  const referralsHref = buildReferralsHref(pathname);

  const freeMonthPercent = useMemo(() => {
    const { current, target } = data.freeMonthProgress;
    if (current === 0 && data.qualifiedCount > 0) return 100;
    return (current / target) * 100;
  }, [data.freeMonthProgress, data.qualifiedCount]);

  const handleCopy = async (text: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        window.setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  const handleShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: copy.title,
          text: copy.subtitle,
          url: data.referralLink,
        });
        return;
      } catch {
        // user cancelled or share failed
      }
    }
    void handleCopy(data.referralLink, "link");
  };

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {!compact && copy.ambassadorBadge && (
        <AmbassadorBadge tier={data.ambassadorTier!} label={copy.ambassadorBadge} />
      )}

      <div
        className={cn(
          "rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent",
          compact ? "p-3" : "p-4"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {copy.creditBalanceLabel}
            </p>
            <p className={cn("font-black text-primary", compact ? "text-2xl" : "text-3xl")}>
              {copy.creditBalance}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.creditBalanceHint}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <StatTile
          icon={Users}
          value={data.totalReferrals}
          label={copy.totalReferrals}
          compact={compact}
        />
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
          icon={PiggyBank}
          value={copy.moneySaved}
          label={copy.moneySavedLabel}
          compact={compact}
        />
        {!compact && (
          <StatTile
            icon={Coins}
            value={copy.creditsEarned}
            label={copy.creditsEarnedLabel}
            compact={compact}
          />
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">{copy.freeMonthHeadline}</p>
        </div>
        <Progress value={freeMonthPercent} className={cn(compact ? "h-2" : "h-2.5")} />
        <p className="text-xs font-medium text-muted-foreground">{copy.freeMonthProgress}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Share2 className="h-3.5 w-3.5" />
          {copy.yourLink}
        </div>
        <div className="flex gap-2">
          <Input readOnly value={data.referralLink} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy(data.referralLink, "link")}
            className="shrink-0 gap-2"
          >
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only">
              {copiedLink ? copy.copied : copy.copyLink}
            </span>
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleShare()} className="shrink-0 gap-2">
            <Share2 className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{copy.share}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Award className="h-3.5 w-3.5" />
          {copy.yourCode}
        </div>
        <div className="flex gap-2">
          <Input readOnly value={data.referralCode} className="font-mono text-sm font-bold tracking-widest" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy(data.referralCode, "code")}
            className="shrink-0 gap-2"
          >
            {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only">
              {copiedCode ? copy.copied : copy.copyCode}
            </span>
          </Button>
        </div>
      </div>

      {!compact && (
        <>
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="h-3.5 w-3.5 text-primary" />
              {copy.ambassadorTitle}
            </div>
            {copy.ambassadorBadge ? (
              <div className="space-y-2">
                <AmbassadorBadge tier={data.ambassadorTier!} label={copy.ambassadorBadge} />
                {copy.nextAmbassador && (
                  <p className="text-xs text-muted-foreground">{copy.nextAmbassador}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {copy.nextAmbassador ?? "Reach 5 paying referrals for Bronze Ambassador"}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {copy.ambassadorTiers.map((tier) => {
                const earned = data.qualifiedCount >= tier.count;
                return (
                  <div
                    key={tier.tier}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center text-[11px] font-semibold",
                      earned
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background/40 text-muted-foreground"
                    )}
                  >
                    {tier.label}
                    <p className="mt-0.5 text-[10px] font-normal opacity-80">{tier.count} refs</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-bold">{copy.leaderboardTitle}</p>
                <p className="text-xs text-muted-foreground">{copy.leaderboardSubtitle}</p>
              </div>
            </div>
            {data.leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualified referrals this month yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-3 font-bold">{copy.leaderboardRank}</th>
                      <th className="pb-2 pr-3 font-bold">{copy.leaderboardUser}</th>
                      <th className="pb-2 text-right font-bold">{copy.leaderboardReferrals}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((entry) => (
                      <tr
                        key={entry.userId}
                        className={cn(
                          "border-b border-border/40 last:border-0",
                          entry.isCurrentUser && "bg-primary/5"
                        )}
                      >
                        <td className="py-2 pr-3 font-black tabular-nums">#{entry.rank}</td>
                        <td className="py-2 pr-3 font-medium">
                          {entry.name}
                          {entry.isCurrentUser && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              {copy.leaderboardYou}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {entry.monthlyReferrals}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">{copy.leaderboardRewards}</p>
          </div>

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
        </>
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
