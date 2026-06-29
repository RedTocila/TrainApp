import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getChallengeById } from "@/lib/actions/challenges";
import { getChallengeBracket } from "@/lib/actions/challenge-bracket";
import { loadChallengeBracketWithPlatformScores } from "@/lib/actions/challenge-platform-scores";
import { isSeriesChallenge } from "@/lib/challenge-series";
import { ChallengeBracketAdmin } from "@/components/challenge-bracket-admin";
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

  let displayBracket = bracket;
  if (isSeriesChallenge(challenge) && bracket.participants.length > 0) {
    displayBracket = await loadChallengeBracketWithPlatformScores(bracket);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Bracket · {challenge.title}</h1>
            <p className="text-sm text-muted-foreground">
              Split participants into groups of {challenge.group_size}, run Zoom calls, and advance
              whoever transformed the most on camera. Group winners meet in a final call for the
              champion.
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

        <ChallengeBracketAdmin bracket={displayBracket} />
      </div>
    </PageTransition>
  );
}
