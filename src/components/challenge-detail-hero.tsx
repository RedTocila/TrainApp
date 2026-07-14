import Link from "next/link";
import { ChallengeMediaFrame } from "@/components/challenge-media-frame";
import { ChallengeShareButton } from "@/components/challenge-share-button";
import { ChallengeRulesButton } from "@/components/challenge-rules-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getChallengeCardVisual } from "@/lib/challenge-card-covers";
import { getChallengeLeagueTag } from "@/lib/challenge-platform-copy";
import type { PlatformCopy } from "@/lib/platform-copy";
import type { Challenge } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export function ChallengeDetailHero({
  challenge,
  copy,
  platformChallenges,
}: {
  challenge: Challenge;
  copy: PlatformCopy["challenges"];
  platformChallenges: PlatformCopy["challenges"];
}) {
  const visual = getChallengeCardVisual(challenge);
  const leagueTag = getChallengeLeagueTag(platformChallenges, challenge);

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Live
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ChallengeShareButton slug={challenge.slug} title={challenge.title} />
          <ChallengeRulesButton copy={copy} slug={challenge.slug} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <ChallengeMediaFrame
          coverImage={visual.coverImage}
          gradient={visual.gradient}
          icon={visual.icon}
          size="hero"
        >
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-end gap-2">
              {leagueTag ? (
                <Badge className="border-white/25 bg-black/40 text-white backdrop-blur-sm">
                  {leagueTag}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-white drop-shadow sm:text-3xl">
              {challenge.title}
            </h1>
          </div>
        </ChallengeMediaFrame>
      </div>
    </header>
  );
}
