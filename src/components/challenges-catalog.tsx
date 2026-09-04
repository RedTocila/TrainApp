"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { ChallengeShareButton } from "@/components/challenge-share-button";
import { Card, CardContent } from "@/components/ui/card";
import { getChallengeCardVisual } from "@/lib/challenge-card-covers";
import type { ChallengeCardMembership } from "@/lib/actions/challenges";
import {
  getChallengeMaxParticipants,
  isFlashChallenge,
} from "@/lib/challenge-series";
import { getChallengeLeagueTag } from "@/lib/challenge-platform-copy";
import { getFlashDurationLabel } from "@/lib/flash-challenge-catalog";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getTransformationDurationLabel } from "@/lib/transformation-challenge-catalog";
import {
  getChallengePrizePoolCents,
  getMaxChallengePrizePoolCents,
  isChallengeActive,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import { usePlatformCopy } from "@/components/locale-provider";
import { buildPricingHref } from "@/lib/pricing-nav";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

function challengeDayProgressPct(challenge: Challenge): number {
  const start = new Date(challenge.scheduled_at).getTime();
  const now = Date.now();
  const durationMs =
    challenge.duration_days && challenge.duration_days > 0
      ? challenge.duration_days * 24 * 60 * 60 * 1000
      : Math.max(1, challenge.duration_months) * 30 * 24 * 60 * 60 * 1000;
  if (now <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / durationMs) * 100)));
}

function CatalogChallengeCard({
  challenge,
  membership,
  requiresUpgrade = false,
}: {
  challenge: Challenge;
  membership?: ChallengeCardMembership;
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();
  const catalogCopy = platform.challenges.catalog as {
    cardEyebrow: string;
    participantsLabel: string;
    spotsLeftLabel: string;
    prizePoolLabel: string;
    prizePoolUpTo: (amount: string) => string;
    yourPosition: string;
    daysProgress: string;
    registeredBadge: string;
    inactiveBadge: string;
  };
  const leagueTag = getChallengeLeagueTag(platform.challenges, challenge);
  const visual = getChallengeCardVisual(challenge);
  const active = isChallengeActive(challenge);
  const isFlash = isFlashChallenge(challenge);
  const max = getChallengeMaxParticipants(challenge) ?? (isFlash ? 50 : 100);
  const participantCount = challenge.participant_count ?? 0;
  const spotsLeft = Math.max(0, max - participantCount);
  const joined = Boolean(membership);
  const dayPct = challengeDayProgressPct(challenge);
  const currentPrizeLabel = formatEurosFromCents(
    getChallengePrizePoolCents(challenge, participantCount)
  );
  const maxPrizeLabel = formatEurosFromCents(getMaxChallengePrizePoolCents(challenge));
  const durationLabel = isFlash
    ? getFlashDurationLabel(challenge)
    : getTransformationDurationLabel(challenge);
  const meta = [durationLabel, leagueTag].filter(Boolean).join(" · ");
  const detailPath = `/dashboard/challenges/${challenge.slug}`;
  const href = requiresUpgrade ? buildPricingHref(detailPath) : detailPath;

  return (
    <div className="relative h-full min-w-0 w-full max-w-full">
      <ChallengeShareButton
        slug={challenge.slug}
        title={challenge.title}
        variant="card"
        className="absolute right-2.5 top-2.5 z-20 h-7 w-7"
      />
      <Link href={href} className="group block h-full min-w-0 w-full max-w-full">
        <motion.article
          className={cn(
            "relative flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-3",
            active ? "transition-shadow hover:shadow-lg" : "opacity-80",
            active ? visual.border : "border-zinc-500/25",
            active ? visual.shadow : "shadow-none"
          )}
          whileHover={active ? { y: -2 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 bg-gradient-to-br",
              active ? visual.gradient : "from-zinc-700 via-zinc-600 to-zinc-800"
            )}
          />
          {visual.coverImage ? (
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 bg-cover bg-[center_right] sm:bg-center",
                !active && "grayscale"
              )}
              style={{ backgroundImage: `url(${visual.coverImage})` }}
            />
          ) : null}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-black/80 from-0% via-black/50 via-[38%] to-transparent to-[68%]",
              !active && "from-black/90 via-black/70"
            )}
          />
          {!active ? (
            <div aria-hidden className="absolute inset-0 bg-zinc-900/35 backdrop-grayscale" />
          ) : null}

          <div
            className={cn(
              "relative z-10 flex w-full min-w-0 max-w-[66%] flex-col gap-1.5",
              active ? "text-white" : "text-zinc-200"
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md backdrop-blur-sm",
                  active ? "bg-amber-400/20" : "bg-zinc-400/15"
                )}
              >
                <Trophy
                  className={cn("h-3 w-3", active ? "text-amber-300" : "text-zinc-400")}
                />
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide",
                  active ? "text-white/75" : "text-zinc-400"
                )}
              >
                {catalogCopy.cardEyebrow}
                {meta ? ` · ${meta}` : null}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  !active
                    ? "bg-zinc-500/40 text-zinc-100"
                    : joined
                      ? "bg-primary text-primary-foreground"
                      : "invisible pointer-events-none bg-primary text-primary-foreground"
                )}
                aria-hidden={active && !joined}
              >
                {active ? catalogCopy.registeredBadge : catalogCopy.inactiveBadge}
              </span>
            </div>

            <h3 className="line-clamp-2 min-h-[2.4rem] text-[15px] font-black leading-tight tracking-tight drop-shadow-sm sm:text-base">
              {challenge.title}
            </h3>

            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-xs font-semibold",
                  active ? "text-amber-200" : "text-zinc-400"
                )}
              >
                {catalogCopy.prizePoolLabel}:{" "}
                <span className={cn("font-black", active ? "text-white" : "text-zinc-200")}>
                  {currentPrizeLabel}
                </span>
              </p>
              <p
                className={cn(
                  "truncate text-[10px] leading-tight",
                  active ? "text-white/65" : "text-zinc-500"
                )}
              >
                {catalogCopy.prizePoolUpTo(maxPrizeLabel)}
              </p>
            </div>

            <div className="min-w-0 space-y-1">
              <div
                className={cn(
                  "flex min-w-0 items-center justify-between gap-2 text-[10px]",
                  active ? "text-white/75" : "text-zinc-500"
                )}
              >
                <span className="truncate">{catalogCopy.daysProgress}</span>
                <span
                  className={cn(
                    "shrink-0 font-bold tabular-nums",
                    active ? "text-white" : "text-zinc-300"
                  )}
                >
                  {dayPct}%
                </span>
              </div>
              <div
                className={cn(
                  "h-1.5 w-full overflow-hidden rounded-full",
                  active ? "bg-white/20" : "bg-zinc-500/30"
                )}
              >
                <div
                  className={cn(
                    "h-full max-w-full rounded-full",
                    active ? "bg-primary" : "bg-zinc-400"
                  )}
                  style={{ width: `${dayPct}%` }}
                />
              </div>
            </div>

            <div
              className={cn(
                "grid min-w-0 grid-cols-2 gap-2 border-t pt-2",
                active ? "border-white/10" : "border-zinc-500/20"
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-[10px] leading-none",
                    active ? "text-white/70" : "text-zinc-500"
                  )}
                >
                  {catalogCopy.spotsLeftLabel}
                </p>
                <p className="mt-1 text-base font-black tabular-nums leading-none">
                  {spotsLeft}
                </p>
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-[10px] leading-none",
                    active ? "text-white/70" : "text-zinc-500"
                  )}
                >
                  {catalogCopy.participantsLabel}
                </p>
                <p className="mt-1 text-base font-black tabular-nums leading-none">
                  {participantCount}
                </p>
              </div>
            </div>
          </div>
        </motion.article>
      </Link>
    </div>
  );
}

export function ChallengesCatalog({
  challenges,
  memberships = {},
  requiresUpgrade = false,
}: {
  challenges: Challenge[];
  memberships?: Record<string, ChallengeCardMembership>;
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();
  const catalog = platform.challenges.catalog as {
    allTag: string;
    flashTag: string;
    menTag: string;
    womenTag: string;
  };
  const counts = useMemo(() => countChallengesByCategory(challenges), [challenges]);
  const [category, setCategory] = useState<ChallengeListCategory>("all");
  const visibleChallenges = useMemo(
    () => filterChallengesByCategory(challenges, category),
    [challenges, category]
  );

  if (challenges.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No community challenges scheduled yet. Check back soon.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4 overflow-x-hidden">
      <ChallengeCategoryFilterBar
        category={category}
        counts={counts}
        onChange={setCategory}
        labels={{
          all: catalog.allTag,
          flash: catalog.flashTag,
          men: catalog.menTag,
          women: catalog.womenTag,
        }}
      />

      {visibleChallenges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No challenges in this category yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid w-full min-w-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleChallenges.map((challenge) => (
            <CatalogChallengeCard
              key={challenge.id}
              challenge={challenge}
              membership={memberships[challenge.id]}
              requiresUpgrade={requiresUpgrade}
            />
          ))}
        </div>
      )}
    </div>
  );
}
