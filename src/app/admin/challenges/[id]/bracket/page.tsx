import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getChallengeById } from "@/lib/actions/challenges";
import { getChallengeBracket } from "@/lib/actions/challenge-bracket";
import { loadChallengeBracketWithPlatformScores } from "@/lib/actions/challenge-platform-scores";
import { isFlashChallenge, isTransformationChallenge } from "@/lib/challenge-series";
import { ChallengeBracketAdmin } from "@/components/challenge-bracket-admin";
import { ChallengeLongChallengeAdmin } from "@/components/challenge-long-challenge-admin";
import { FlashChallengeAdmin } from "@/components/flash-challenge-admin";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function AdminChallengeBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const challenge = await getChallengeById(id);
  if (!challenge) notFound();

  const bracket = await getChallengeBracket(id);
  if (!bracket) notFound();

  const isTransformation = isTransformationChallenge(challenge);
  const isFlash = isFlashChallenge(challenge);

  let displayBracket = bracket;
  if (isTransformationChallenge(challenge) && bracket.participants.length > 0) {
    displayBracket = await loadChallengeBracketWithPlatformScores(bracket);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">
              {isTransformation ? "Leaderboard" : isFlash ? "Flash challenge" : "Bracket"} ·{" "}
              {challenge.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTransformation
                ? "Rank participants by accumulated daily points, invite top scorers to judgment-day Zoom, then crown the winner."
                : isFlash
                  ? "24-hour sprint — first 10 start the clock, groups of 10 on Zoom, crown the highest record."
                  : "Split participants into groups, run Zoom calls, and advance whoever transformed the most on camera."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/challenges/${id}/edit`}>
              <Button variant="outline" size="sm">
                Edit details
              </Button>
            </Link>
            <Link href="/admin/challenges">
              <Button variant="ghost" size="sm">
                All challenges
              </Button>
            </Link>
          </div>
        </div>

        {isTransformation ? (
          <ChallengeLongChallengeAdmin bracket={displayBracket} />
        ) : isFlash ? (
          <FlashChallengeAdmin bracket={displayBracket} />
        ) : (
          <ChallengeBracketAdmin bracket={displayBracket} />
        )}
      </div>
    </PageTransition>
  );
}
