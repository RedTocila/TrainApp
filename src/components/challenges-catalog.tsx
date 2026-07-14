"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { ChallengeMediaFrame } from "@/components/challenge-media-frame";
import { ChallengePrizePool } from "@/components/challenge-prize-pool";
import { ChallengeShareButton } from "@/components/challenge-share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getChallengeCardVisual } from "@/lib/challenge-card-covers";
import { getChallengeMaxParticipants, isFlashChallenge } from "@/lib/challenge-series";
import { getChallengeLeagueTag } from "@/lib/challenge-platform-copy";
import { getFlashDurationLabel } from "@/lib/flash-challenge-catalog";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getTransformationDurationLabel } from "@/lib/transformation-challenge-catalog";
import { usePlatformCopy } from "@/components/locale-provider";
import type { Challenge } from "@/lib/types";
import { cn } from "@/lib/utils";

function CatalogChallengeCard({ challenge }: { challenge: Challenge }) {
  const platform = usePlatformCopy();
  const catalogCopy = platform.challenges.catalog;
  const joinCopy = platform.challenges.join;
  const prizeCopy = platform.challenges.prizePool;
  const leagueTag = getChallengeLeagueTag(platform.challenges, challenge);
  const visual = getChallengeCardVisual(challenge);
  const isFlash = isFlashChallenge(challenge);
  const max = getChallengeMaxParticipants(challenge) ?? (isFlash ? 50 : 100);
  const participantCount = challenge.participant_count ?? 0;
  const durationLabel = isFlash
    ? getFlashDurationLabel(challenge)
    : getTransformationDurationLabel(challenge);
  const spotsLabel = joinCopy.spotsRemaining
    .replace("{remaining}", String(Math.max(0, max - participantCount)))
    .replace("{max}", String(max));

  return (
    <div className="relative h-full">
      <ChallengeShareButton
        slug={challenge.slug}
        title={challenge.title}
        variant="card"
        className="absolute right-3 top-3 z-20"
      />
      <Link href={`/dashboard/challenges/${challenge.slug}`} className="group block h-full">
        <motion.article
          layout
          className={cn(
            "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card",
            "transition-shadow hover:shadow-lg",
            visual.border,
            visual.shadow
          )}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <ChallengeMediaFrame
            coverImage={visual.coverImage}
            gradient={visual.gradient}
            icon={visual.icon}
            size="card"
          >
            <div className="absolute bottom-3 left-3 right-12 flex flex-wrap gap-1.5">
              <Badge className={cn("border backdrop-blur-sm", visual.badge)}>
                {durationLabel}
              </Badge>
              {leagueTag ? (
                <Badge className="border-white/25 bg-black/35 text-white backdrop-blur-sm">
                  {leagueTag}
                </Badge>
              ) : null}
              {isFlash ? (
                <Badge className="border-white/25 bg-black/35 text-white backdrop-blur-sm">
                  {prizeCopy.entryFee}
                </Badge>
              ) : null}
            </div>
          </ChallengeMediaFrame>

          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <div className="space-y-2">
              <h3 className="text-lg font-black leading-snug tracking-tight sm:text-xl">
                {challenge.title}
              </h3>
              <ChallengePrizePool
                challenge={challenge}
                participantCount={participantCount}
                variant="catalog"
              />
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {spotsLabel}
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 self-start text-sm font-semibold text-primary">
              {catalogCopy.viewChallenge}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
            <CatalogChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}
    </div>
  );
}
