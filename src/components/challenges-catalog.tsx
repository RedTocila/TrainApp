"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Users, Zap } from "lucide-react";
import { ChallengePrizePool } from "@/components/challenge-prize-pool";
import { ChallengeShareButton } from "@/components/challenge-share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  challengeExcerpt,
  isChallengeAtCapacity,
} from "@/lib/challenge-utils";
import { getChallengeMaxParticipants, isFlashChallenge, isTransformationChallenge } from "@/lib/challenge-series";
import { getFlashDurationLabel, type FlashChallengeSlug } from "@/lib/flash-challenge-catalog";
import { getTransformationDurationLabel } from "@/lib/transformation-challenge-catalog";
import type { TransformationChallengeSlug } from "@/lib/transformation-challenges";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChallengeCategory = "long" | "flash";

type CardTheme = {
  gradient: string;
  border: string;
  shadow: string;
  hoverShadow: string;
  badge: string;
};

const LONG_CARD_THEMES: Record<TransformationChallengeSlug, CardTheme> = {
  "transformation-30-day": {
    gradient: "bg-gradient-to-br from-rose-600 via-orange-600 to-amber-700",
    border: "border-rose-500/35",
    shadow: "shadow-rose-500/10",
    hoverShadow: "group-hover:shadow-rose-500/25",
    badge: "border-rose-300/40 bg-rose-500/25 text-rose-50",
  },
  "transformation-90-day": {
    gradient: "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800",
    border: "border-violet-500/35",
    shadow: "shadow-violet-500/10",
    hoverShadow: "group-hover:shadow-violet-500/25",
    badge: "border-violet-400/40 bg-violet-500/25 text-violet-100",
  },
  "transformation-6-month": {
    gradient: "bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-800",
    border: "border-sky-500/35",
    shadow: "shadow-sky-500/10",
    hoverShadow: "group-hover:shadow-sky-500/25",
    badge: "border-sky-300/40 bg-sky-500/25 text-sky-50",
  },
  "transformation-12-month": {
    gradient: "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-800",
    border: "border-emerald-500/35",
    shadow: "shadow-emerald-500/10",
    hoverShadow: "group-hover:shadow-emerald-500/25",
    badge: "border-emerald-300/40 bg-emerald-500/25 text-emerald-50",
  },
};

const FLASH_CARD_THEMES: Record<FlashChallengeSlug, CardTheme> = {
  "flash-longest-plank": {
    gradient: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-700",
    border: "border-amber-500/35",
    shadow: "shadow-amber-500/10",
    hoverShadow: "group-hover:shadow-amber-500/25",
    badge: "border-amber-300/40 bg-amber-500/25 text-amber-50",
  },
  "flash-longest-wall-sit": {
    gradient: "bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-800",
    border: "border-fuchsia-500/35",
    shadow: "shadow-fuchsia-500/10",
    hoverShadow: "group-hover:shadow-fuchsia-500/25",
    badge: "border-fuchsia-300/40 bg-fuchsia-500/25 text-fuchsia-50",
  },
  "flash-most-burpees-10min": {
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

  return {
    isFlash,
    max,
    theme: isFlash
      ? (FLASH_CARD_THEMES[challenge.slug as FlashChallengeSlug] ??
          FLASH_CARD_THEMES["flash-longest-plank"])
      : (LONG_CARD_THEMES[challenge.slug as TransformationChallengeSlug] ??
          LONG_CARD_THEMES["transformation-90-day"]),
    durationLabel: isFlash
      ? getFlashDurationLabel(challenge)
      : getTransformationDurationLabel(challenge),
    entryBadge: isFlash ? entryFeeLabel : undefined,
  };
}

function CatalogChallengeCard({
  challenge,
  theme,
  durationLabel,
  spotsLabel,
  isFull,
  entryBadge,
  isFlash,
  participantsLabel,
}: {
  challenge: Challenge;
  theme: CardTheme;
  durationLabel: string;
  spotsLabel: string;
  isFull: boolean;
  entryBadge?: string;
  isFlash?: boolean;
  participantsLabel?: string;
}) {
  const platform = usePlatformCopy();
  const catalogCopy = platform.challenges.catalog;
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
        <div className={cn("absolute inset-0 opacity-90", theme.gradient)} />
        <div className="relative flex min-h-[220px] flex-col justify-between p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border", theme.badge)}>
                <Radio className="mr-1 h-3 w-3 animate-pulse" />
                {durationLabel}
              </Badge>
              {entryBadge ? (
                <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                  {entryBadge}
                </Badge>
              ) : null}
              <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                <Users className="mr-1 h-3 w-3" />
                {isFull ? "Waitlist" : "Open"}
              </Badge>
            </div>
            <h3 className="text-xl font-black leading-tight text-white sm:text-2xl">
              {challenge.title}
            </h3>
            <p className="text-sm font-medium text-white/90">{spotsLabel}</p>
            <p className="line-clamp-2 text-sm text-white/75">
              {challengeExcerpt(challenge.description, 100)}
            </p>
            {isFlash ? (
              <div className="space-y-2">
                <ChallengePrizePool
                  challenge={challenge}
                  participantCount={participantCount}
                  variant="hero"
                  heroSize="lg"
                  prizeMode="max"
                  tone="onGradient"
                  className="w-full"
                />
                {participantsLabel ? (
                  <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                    <Users className="mr-1 h-3 w-3" />
                    {participantsLabel}
                  </Badge>
                ) : null}
              </div>
            ) : (
              <ChallengePrizePool
                challenge={challenge}
                participantCount={participantCount}
                variant="hero"
                prizeMode="max"
                tone="onGradient"
                className="max-w-xs"
              />
            )}
          </div>
          <span className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            {catalogCopy.viewChallenge}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </motion.article>
      </Link>
    </div>
  );
}

function CategoryTag({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  activeClassName,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: typeof Radio;
  activeClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-auto shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap",
        active
          ? activeClassName
          : "border-border bg-muted text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span>{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1 py-px text-[10px] leading-none tabular-nums",
          active ? "bg-black/15" : "bg-background/80"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function ChallengesCatalog({ challenges }: { challenges: Challenge[] }) {
  const platform = usePlatformCopy();
  const catalogCopy = platform.challenges.catalog;
  const joinCopy = platform.challenges.join;
  const prizeCopy = platform.challenges.prizePool;
  const longChallenges = useMemo(
    () => challenges.filter((c) => isTransformationChallenge(c)),
    [challenges]
  );
  const flashChallenges = useMemo(
    () => challenges.filter((c) => isFlashChallenge(c)),
    [challenges]
  );

  const [category, setCategory] = useState<ChallengeCategory>("long");

  const visibleChallenges = category === "long" ? longChallenges : flashChallenges;
  const categorySubtitle =
    category === "long" ? catalogCopy.longSubtitle : catalogCopy.flashSubtitle;

  const hasContent = longChallenges.length + flashChallenges.length > 0;

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
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label="Challenge categories"
      >
        <CategoryTag
          active={category === "long"}
          onClick={() => setCategory("long")}
          label={catalogCopy.longTag}
          count={longChallenges.length}
          icon={Radio}
          activeClassName="border-violet-500/30 bg-violet-500/10 text-violet-200"
        />
        <CategoryTag
          active={category === "flash"}
          onClick={() => setCategory("flash")}
          label={catalogCopy.flashTag}
          count={flashChallenges.length}
          icon={Zap}
          activeClassName="border-amber-500/30 bg-amber-500/10 text-amber-200"
        />
      </div>

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
            const { theme, durationLabel, max, entryBadge, isFlash } = getChallengeCardProps(
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
                isFull={isChallengeAtCapacity(challenge, count)}
                entryBadge={entryBadge}
                isFlash={isFlash}
                participantsLabel={prizeCopy.participants.replace("{count}", String(count))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
