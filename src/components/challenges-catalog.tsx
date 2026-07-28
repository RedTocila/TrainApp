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
  };
  const leagueTag = getChallengeLeagueTag(platform.challenges, challenge);
  const visual = getChallengeCardVisual(challenge);
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
            "transition-shadow hover:shadow-lg",
            visual.border,
            visual.shadow
          )}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div
            aria-hidden
            className={cn("absolute inset-0 bg-gradient-to-br", visual.gradient)}
          />
          {visual.coverImage ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-[center_right] sm:bg-center"
              style={{ backgroundImage: `url(${visual.coverImage})` }}
            />
          ) : null}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/80 from-0% via-black/50 via-[38%] to-transparent to-[68%]"
          />

          <div className="relative z-10 flex w-full min-w-0 max-w-[66%] flex-col gap-1.5 text-white">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-400/20 backdrop-blur-sm">
                <Trophy className="h-3 w-3 text-amber-300" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-white/75">
                {catalogCopy.cardEyebrow}
                {meta ? ` · ${meta}` : null}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  joined
                    ? "bg-primary text-primary-foreground"
                    : "invisible pointer-events-none bg-primary text-primary-foreground"
                )}
                aria-hidden={!joined}
              >
                {catalogCopy.registeredBadge}
              </span>
            </div>

            <h3 className="line-clamp-2 min-h-[2.4rem] text-[15px] font-black leading-tight tracking-tight drop-shadow-sm sm:text-base">
              {challenge.title}
            </h3>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-amber-200">
                {catalogCopy.prizePoolLabel}:{" "}
                <span className="font-black text-white">{currentPrizeLabel}</span>
              </p>
              <p className="truncate text-[10px] leading-tight text-white/65">
                {catalogCopy.prizePoolUpTo(maxPrizeLabel)}
              </p>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-white/75">
                <span className="truncate">{catalogCopy.daysProgress}</span>
                <span className="shrink-0 font-bold tabular-nums text-white">
                  {dayPct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full max-w-full rounded-full bg-primary"
                  style={{ width: `${dayPct}%` }}
                />
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 border-t border-white/10 pt-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] leading-none text-white/70">
                  {catalogCopy.spotsLeftLabel}
                </p>
                <p className="mt-1 text-base font-black tabular-nums leading-none">
                  {spotsLeft}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] leading-none text-white/70">
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
  profileGender,
  memberships = {},
  requiresUpgrade = false,
}: {
  challenges: Challenge[];
  profileGender?: string | null;
  memberships?: Record<string, ChallengeCardMembership>;
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();
  const catalog = platform.challenges.catalog as {
    longSubtitle: string;
    longSubtitleMen?: string;
    longSubtitleWomen?: string;
    flashSubtitle: string;
    flashSubtitleAlex?: string;
    allTag: string;
    allSubtitle: string;
    flashTag: string;
    menTag: string;
    womenTag: string;
  };
  const longSubtitle =
    profileGender === "female" && catalog.longSubtitleWomen
      ? catalog.longSubtitleWomen
      : catalog.longSubtitleMen ?? catalog.longSubtitle;
  const flashSubtitle = catalog.flashSubtitleAlex ?? catalog.flashSubtitle;
  const counts = useMemo(() => countChallengesByCategory(challenges), [challenges]);
  const [category, setCategory] = useState<ChallengeListCategory>("all");
  const visibleChallenges = useMemo(
    () => filterChallengesByCategory(challenges, category),
    [challenges, category]
  );

  const categorySubtitle =
    category === "flash"
      ? flashSubtitle
      : category === "men"
        ? catalog.longSubtitleMen ?? longSubtitle
        : category === "women"
          ? catalog.longSubtitleWomen ?? longSubtitle
          : catalog.allSubtitle;

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

      <p className="text-sm text-muted-foreground">{categorySubtitle}</p>

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
