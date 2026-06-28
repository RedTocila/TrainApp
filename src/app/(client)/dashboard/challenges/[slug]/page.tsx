import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getChallengeBySlug } from "@/lib/actions/challenges";
import { getChallengeAnnouncementsBySlug } from "@/lib/actions/challenge-announcements";
import { getChallengeBracketBySlug } from "@/lib/actions/challenge-bracket";
import { isDemoChallengeSlug } from "@/lib/challenge-demo";
import { EliteUpgradeGate } from "@/components/elite-upgrade-gate";
import { ChallengeAnnouncements } from "@/components/challenge-announcements";
import { ChallengeBracketDiagram } from "@/components/challenge-bracket-diagram";
import { ChallengeDetailVisuals } from "@/components/challenge-detail-visuals";
import { ChallengePrizePool } from "@/components/challenge-prize-pool";
import { ChallengeRegisterButton } from "@/components/challenge-register-button";
import { ChallengeRulesButton } from "@/components/challenge-rules-panel";
import { ChallengeZoomPanel } from "@/components/challenge-zoom-panel";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canJoinChallenge, getChallengeStatus } from "@/lib/challenge-utils";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { PLATFORM_ELITE_NAME } from "@/lib/brand";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasEliteAccess } from "@/lib/subscription";
import { ArrowLeft, GitBranch } from "lucide-react";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireClient();
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const platform = getPlatformCopy(parseCheckoutLocale(profile?.preferred_locale));

  if (!profile || !hasEliteAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-4">
          <EliteUpgradeGate
            title={`${PLATFORM_ELITE_NAME} required for community challenges`}
            description={platform.classes.upgradeDescriptionShort}
          />
        </div>
      </PageTransition>
    );
  }

  const challenge = await getChallengeBySlug(slug);
  if (!challenge) notFound();

  const bracket = await getChallengeBracketBySlug(slug, user!.id);
  if (!bracket) notFound();

  const announcements = await getChallengeAnnouncementsBySlug(slug);

  const status = getChallengeStatus(challenge);
  const joinable = canJoinChallenge(challenge);

  const isDemo = isDemoChallengeSlug(slug);
  const isRegistered = isDemo || !!bracket.currentUserParticipantId;
  const copy = platform.challenges;

  return (
    <PageTransition>
      <article className="mx-auto max-w-4xl space-y-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/classes">
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Live
            </Button>
          </Link>
          <ChallengeRulesButton copy={copy} slug={slug} />
        </div>

        <header>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{challenge.title}</h1>
        </header>

        <ChallengeAnnouncements announcements={announcements} />

        <ChallengePrizePool
          challenge={challenge}
          participantCount={bracket.participants.length}
        />

        <ChallengeDetailVisuals
          copy={copy}
          challenge={challenge}
          participantCount={bracket.participants.length}
        />

        <section className="space-y-3">
          {status !== "ended" && !isDemo && (
            <ChallengeRegisterButton
              challengeId={challenge.id}
              isRegistered={isRegistered}
            />
          )}

          <ChallengeZoomPanel bracket={bracket} joinable={joinable && status !== "ended"} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{copy.bracketTitle}</h2>
          </div>
          <ChallengeBracketDiagram bracket={bracket} />
        </section>

        {status === "ended" && !bracket.champion && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              This challenge has ended. The champion will appear once the final round is complete.
            </CardContent>
          </Card>
        )}

        {challenge.description.trim() && (
          <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-p:text-sm">
            <ReactMarkdown>{challenge.description}</ReactMarkdown>
          </div>
        )}
      </article>
    </PageTransition>
  );
}
