import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getChallengeBySlug } from "@/lib/actions/challenges";
import { getChallengeBracketBySlug } from "@/lib/actions/challenge-bracket";
import { isDemoChallengeSlug } from "@/lib/challenge-demo";
import { EliteUpgradeGate } from "@/components/elite-upgrade-gate";
import { ChallengeBracketDiagram } from "@/components/challenge-bracket-diagram";
import { ChallengeRegisterButton } from "@/components/challenge-register-button";
import { ChallengeRulesButton } from "@/components/challenge-rules-panel";
import { ChallengeZoomPanel } from "@/components/challenge-zoom-panel";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canJoinChallenge, getChallengeStatus } from "@/lib/challenge-utils";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { PLATFORM_ELITE_NAME } from "@/lib/brand";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasEliteAccess } from "@/lib/subscription";
import { ArrowLeft, Radio, Trophy, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const status = getChallengeStatus(challenge);
  const joinable = canJoinChallenge(challenge);

  const statusStyles = {
    upcoming: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    live: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
    ended: "bg-muted text-muted-foreground border-border",
  };

  const isDemo = isDemoChallengeSlug(slug);
  const isRegistered = isDemo || !!bracket.currentUserParticipantId;

  return (
    <PageTransition>
      <article className="mx-auto max-w-5xl space-y-8">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Live
          </Button>
        </Link>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border", statusStyles[status])}>
              {status === "live" && <Radio className="mr-1 h-3 w-3" />}
              {status === "live" ? "Live now" : status === "upcoming" ? "Upcoming" : "Ended"}
            </Badge>
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              {bracket.participants.length} registered
            </Badge>
            {bracket.champion && (
              <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-200">
                <Trophy className="mr-1 h-3 w-3" />
                {bracket.champion.display_name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{challenge.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(new Date(challenge.scheduled_at), "EEEE, MMMM d · h:mm a")}
                {challenge.duration_minutes > 0 && ` · ${challenge.duration_minutes} min`}
                {" · "}
                Groups of {challenge.group_size}
              </p>
            </div>
            <ChallengeRulesButton copy={platform.challenges} />
          </div>
        </header>

        {status === "upcoming" && !joinable && (
          <Card>
            <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
              <Video className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Zoom links open 15 minutes before the challenge starts. Register now so you are
                included when groups are drawn.
              </p>
            </CardContent>
          </Card>
        )}

        {status !== "ended" && !isDemo && (
          <ChallengeRegisterButton
            challengeId={challenge.id}
            isRegistered={isRegistered}
          />
        )}

        {isDemo && (
          <p className="text-sm font-medium text-emerald-400">
            You are registered for this demo (Group 2).
          </p>
        )}

        <ChallengeZoomPanel bracket={bracket} joinable={joinable && status !== "ended"} />

        {isDemo && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            This is a <strong className="text-foreground">preview challenge</strong> with 100 sample
            participants in <strong className="text-foreground">10 groups</strong> — expand a group
            to see its members. You appear in <strong className="text-foreground">Group 2</strong>{" "}
            as &ldquo;You (demo)&rdquo;. Create real events in{" "}
            <strong className="text-foreground">Admin → Challenges</strong>.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{platform.challenges.bracketTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {platform.challenges.bracketIntro.replace(
              "{groupSize}",
              String(challenge.group_size)
            )}
          </p>
          <ChallengeBracketDiagram bracket={bracket} />
        </section>

        {status === "ended" && !bracket.champion && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              This challenge has ended. The champion will appear here once the final round is
              complete.
            </CardContent>
          </Card>
        )}

        {challenge.description.trim() && (
          <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-primary">
            <ReactMarkdown>{challenge.description}</ReactMarkdown>
          </div>
        )}
      </article>
    </PageTransition>
  );
}
