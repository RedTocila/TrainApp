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
    <div className="relative h-full">
      <ChallengeShareButton
        slug={challenge.slug}
        title={challenge.title}
        variant="card"
        className="absolute right-3 top-3 z-20"
      />
      <Link href={href} className="group block h-full">
        <motion.article
          layout
          className={cn(
            "relative flex h-full min-h-[210px] flex-col overflow-hidden rounded-3xl border p-4 sm:p-5",
            "transition-shadow hover:shadow-lg",
            visual.border,
            visual.shadow
          )}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {visual.coverImage ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${visual.coverImage})` }}
            />
          ) : (
            <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", visual.gradient)} />
          )}
          {/* Left→middle gradient for readable text; right stays colorful */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/80 from-0% via-black/45 via-[42%] to-transparent to-[55%]"
          />

          <div className="relative z-10 flex flex-1 flex-col gap-3 text-white">
            <div className="flex items-center gap-2 pr-10">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 backdrop-blur-sm">
                <Trophy className="h-4 w-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-white/75">
                  {catalogCopy.cardEyebrow}
                  {meta ? ` · ${meta}` : null}
                </p>
              </div>
              {joined ? (
                <span className="ml-auto shrink-0 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {catalogCopy.registeredBadge}
                </span>
              ) : null}
            </div>

            <h3 className="text-xl font-black leading-snug tracking-tight drop-shadow-sm">
              {challenge.title}
            </h3>

            <div>
              <p className="text-sm font-semibold text-amber-200">
                {catalogCopy.prizePoolLabel}:{" "}
                <span className="text-base font-black text-white">{currentPrizeLabel}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-white/65">
                {catalogCopy.prizePoolUpTo(maxPrizeLabel)}
              </p>
            </div>

            {joined ? (
              <div className="mt-auto space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/75">
                    <span>{catalogCopy.daysProgress}</span>
                    <span className="font-bold tabular-nums text-white">{dayPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${dayPct}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-white/70">{catalogCopy.yourPosition}</p>
                    <p className="text-xl font-black tabular-nums">
                      #{membership?.rank ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/70">
                      {catalogCopy.participantsLabel}
                    </p>
                    <p className="text-xl font-black tabular-nums">{participantCount}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-auto grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-white/70">{catalogCopy.spotsLeftLabel}</p>
                  <p className="text-xl font-black tabular-nums">{spotsLeft}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/70">
                    {catalogCopy.participantsLabel}
                  </p>
                  <p className="text-xl font-black tabular-nums">{participantCount}</p>
                </div>
              </div>
            )}
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
    <div className="space-y-4">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
