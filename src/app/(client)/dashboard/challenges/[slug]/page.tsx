import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getChallengeBySlug } from "@/lib/actions/challenges";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { ChallengeRoomClient } from "@/components/challenge-room-client";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canJoinChallenge,
  getChallengeStatus,
} from "@/lib/challenge-utils";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasAiAccess } from "@/lib/subscription";
import { ArrowLeft, Radio, Users, Video } from "lucide-react";
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

  if (!profile || !hasAiAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-4">
          <AiUpgradeGate
            title={`${PLATFORM_AI_NAME} required for community challenges`}
            description={platform.classes.upgradeDescriptionShort}
          />
        </div>
      </PageTransition>
    );
  }

  const challenge = await getChallengeBySlug(slug);
  if (!challenge) notFound();

  const status = getChallengeStatus(challenge);
  const joinable = canJoinChallenge(challenge);

  const statusStyles = {
    upcoming: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    live: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
    ended: "bg-muted text-muted-foreground border-border",
  };

  return (
    <PageTransition>
      <article className="mx-auto max-w-4xl space-y-8">
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
              Community
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{challenge.title}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(challenge.scheduled_at), "EEEE, MMMM d · h:mm a")}
            {challenge.duration_minutes > 0 && ` · ${challenge.duration_minutes} min`}
          </p>
        </header>

        {joinable && status !== "ended" && (
          <ChallengeRoomClient challengeSlug={challenge.slug} challengeTitle={challenge.title} />
        )}

        {status === "upcoming" && !joinable && (
          <Card>
            <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
              <Video className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The community room opens 15 minutes before the challenge starts. Come back then to
                join on camera or mic.
              </p>
            </CardContent>
          </Card>
        )}

        {status === "ended" && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              This challenge session has ended. Watch for the next one on the Live tab.
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
