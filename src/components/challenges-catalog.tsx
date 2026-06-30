"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Radio } from "lucide-react";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { ChallengePrizePool } from "@/components/challenge-prize-pool";
import { ChallengeShareButton } from "@/components/challenge-share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getChallengeMaxParticipants, isFlashChallenge } from "@/lib/challenge-series";
import { getChallengeLeagueTag } from "@/lib/challenge-platform-copy";
import { getChallengeGender, getTransformationTierKey } from "@/lib/challenge-gender";
import { getFlashDurationLabel, type FlashChallengeSlug } from "@/lib/flash-challenge-catalog";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getTransformationDurationLabel } from "@/lib/transformation-challenge-catalog";
import type { TransformationTierKey } from "@/lib/transformation-challenges";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

type CardTheme = {
  gradient: string;
  coverImage?: string;
  border: string;
  shadow: string;
  hoverShadow: string;
  badge: string;
};

const LONG_CARD_THEMES: Record<TransformationTierKey, Omit<CardTheme, "coverImage">> = {
  "30-day": {
    gradient: "bg-gradient-to-br from-orange-600 via-orange-500 to-amber-600",
    border: "border-orange-500/35",
    shadow: "shadow-orange-500/10",
    hoverShadow: "group-hover:shadow-orange-500/25",
    badge: "border-orange-300/40 bg-orange-500/25 text-orange-50",
  },
  "90-day": {
    gradient: "bg-gradient-to-br from-purple-600 via-violet-600 to-purple-800",
    border: "border-purple-500/35",
    shadow: "shadow-purple-500/10",
    hoverShadow: "group-hover:shadow-purple-500/25",
    badge: "border-purple-300/40 bg-purple-500/25 text-purple-50",
  },
  "6-month": {
    gradient: "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800",
    border: "border-blue-500/35",
    shadow: "shadow-blue-500/10",
    hoverShadow: "group-hover:shadow-blue-500/25",
    badge: "border-blue-300/40 bg-blue-500/25 text-blue-50",
  },
  "12-month": {
    gradient: "bg-gradient-to-br from-red-900 via-neutral-900 to-black",
    border: "border-red-500/35",
    shadow: "shadow-red-500/10",
    hoverShadow: "group-hover:shadow-red-500/25",
    badge: "border-red-300/40 bg-red-500/25 text-red-50",
  },
};

const LONG_CARD_COVER_IMAGES: Record<
  TransformationTierKey,
  { men: string; women: string }
> = {
  "30-day": {
    men: "/challenges/cards/transformation-30-day-men.png",
    women: "/challenges/cards/transformation-30-day-women.png",
  },
  "90-day": {
    men: "/challenges/cards/transformation-90-day-men.png",
    women: "/challenges/cards/transformation-90-day-women.png",
  },
  "6-month": {
    men: "/challenges/cards/transformation-6-month-men.png",
    women: "/challenges/cards/transformation-6-month-women.png",
  },
  "12-month": {
    men: "/challenges/cards/transformation-12-month-men.png",
    women: "/challenges/cards/transformation-12-month-women.png",
  },
};

function getLongChallengeCoverImage(challenge: Challenge): string {
  const tier = getTransformationTierKey(challenge.slug) as TransformationTierKey;
  const covers = LONG_CARD_COVER_IMAGES[tier] ?? LONG_CARD_COVER_IMAGES["90-day"];
  const gender = getChallengeGender(challenge);
  return gender === "female" ? covers.women : covers.men;
}

const FLASH_CARD_THEMES: Record<FlashChallengeSlug, CardTheme> = {
  "flash-longest-plank": {
    coverImage: "/challenges/cards/flash-longest-plank.png",
    gradient: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-700",
    border: "border-orange-500/35",
    shadow: "shadow-orange-500/10",
    hoverShadow: "group-hover:shadow-orange-500/25",
    badge: "border-orange-300/40 bg-orange-500/25 text-orange-50",
  },
  "flash-longest-wall-sit": {
    coverImage: "/challenges/cards/flash-longest-wall-sit.png",
    gradient: "bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-800",
    border: "border-pink-500/35",
    shadow: "shadow-pink-500/10",
    hoverShadow: "group-hover:shadow-pink-500/25",
    badge: "border-pink-300/40 bg-pink-500/25 text-pink-50",
  },
  "flash-most-burpees-10min": {
    coverImage: "/challenges/cards/flash-most-burpees-10min.png",
    gradient: "bg-gradient-to-br from-lime-500 via-emerald-600 to-teal-800",
    border: "border-lime-500/35",
    shadow: "shadow-lime-500/10",
    hoverShadow: "group-hover:shadow-lime-500/25",
    badge: "border-lime-300/40 bg-lime-500/25 text-lime-50",
  },
};

function getChallengeCardProps(challenge: Challenge, entryFeeLabel: string) {
  const isFlash = isFlashChallenge(challenge);
  const max = getChallengeMaxParticipants(challenge) ?? (isFlash ? 50 : 100);

  if (isFlash) {
    const flashTheme =
      FLASH_CARD_THEMES[challenge.slug as FlashChallengeSlug] ??
      FLASH_CARD_THEMES["flash-longest-plank"];
    return {
      isFlash,
      max,
      theme: flashTheme,
      durationLabel: getFlashDurationLabel(challenge),
      entryBadge: entryFeeLabel,
    };
  }

  const tier = getTransformationTierKey(challenge.slug) as TransformationTierKey;
  const baseTheme = LONG_CARD_THEMES[tier] ?? LONG_CARD_THEMES["90-day"];

  return {
    isFlash,
    max,
    theme: {
      ...baseTheme,
      coverImage: getLongChallengeCoverImage(challenge),
    },
    durationLabel: getTransformationDurationLabel(challenge),
    entryBadge: undefined,
  };
}

function CatalogChallengeCard({
  challenge,
  theme,
  durationLabel,
  spotsLabel,
  entryBadge,
}: {
  challenge: Challenge;
  theme: CardTheme;
  durationLabel: string;
  spotsLabel: string;
  entryBadge?: string;
}) {
  const platform = usePlatformCopy();
  const catalogCopy = platform.challenges.catalog;
  const leagueTag = getChallengeLeagueTag(platform.challenges, challenge);
  const participantCount = challenge.participant_count ?? 0;

  return (
    <div className="relative h-full">
      <ChallengeShareButton
        slug={challenge.slug}
        title={challenge.title}
        variant="card"
        className="absolute right-3 top-3 z-10"
      />
      <Link href={`/dashboard/challenges/${challenge.slug}`} className="group block h-full">
      <motion.article
        layout
        className={cn(
          "relative h-full overflow-hidden rounded-2xl border bg-card shadow-2xl transition-shadow",
          theme.border,
          theme.shadow,
          theme.hoverShadow
        )}
        whileHover={{ y: -4 }}
      >
        {theme.coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theme.coverImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/10" />
          </>
        ) : (
          <div className={cn("absolute inset-0 opacity-90", theme.gradient)} />
        )}
        <div className="relative flex min-h-[200px] flex-col justify-between gap-4 p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 pr-10">
              <Badge className={cn("border", theme.badge)}>
                <Radio className="mr-1 h-3 w-3 animate-pulse" />
                {durationLabel}
              </Badge>
              {leagueTag ? (
                <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                  {leagueTag}
                </Badge>
              ) : null}
              {entryBadge ? (
                <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                  {entryBadge}
                </Badge>
              ) : null}
            </div>
            <h3 className="text-xl font-black leading-tight text-white sm:text-2xl">
              {challenge.title}
            </h3>
            <ChallengePrizePool
              challenge={challenge}
              participantCount={participantCount}
              variant="catalog"
              tone="onGradient"
            />
            <p className="text-sm font-medium text-white/90">{spotsLabel}</p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            {catalogCopy.viewChallenge}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </motion.article>
      </Link>
    </div>
  );
}

export function ChallengesCatalog({
  challenges,
  profileGender,
}: {
  challenges: Challenge[];
  profileGender?: string | null;
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
    viewChallenge: string;
  };
  const longSubtitle =
    profileGender === "female" && catalog.longSubtitleWomen
      ? catalog.longSubtitleWomen
      : catalog.longSubtitleMen ?? catalog.longSubtitle;
  const flashSubtitle = catalog.flashSubtitleAlex ?? catalog.flashSubtitle;
  const joinCopy = platform.challenges.join;
  const prizeCopy = platform.challenges.prizePool;
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

  const hasContent = challenges.length > 0;

  if (!hasContent) {
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
        <div
          className={cn(
            "grid gap-4",
            category === "flash" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
          )}
        >
          {visibleChallenges.map((challenge) => {
            const { theme, durationLabel, max, entryBadge } = getChallengeCardProps(
              challenge,
              prizeCopy.entryFee
            );
            const count = challenge.participant_count ?? 0;
            return (
              <CatalogChallengeCard
                key={challenge.id}
                challenge={challenge}
                theme={theme}
                durationLabel={durationLabel}
                spotsLabel={joinCopy.spotsRemaining
                  .replace("{remaining}", String(Math.max(0, max - count)))
                  .replace("{max}", String(max))}
                entryBadge={entryBadge}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
