import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getChallengeBySlug } from "@/lib/actions/challenges";
import { ChallengeRulesInstructionsClient } from "@/components/challenge-rules-instructions-client";
import { FlashChallengeRulesClient } from "@/components/flash-challenge-rules-client";
import { PageTransition } from "@/components/page-transition";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getChallengeDurationMonths } from "@/lib/challenge-utils";
import { isFlashChallenge } from "@/lib/challenge-series";
import { getPlatformCopy } from "@/lib/platform-copy";
import { resolveChallengePlatformCopy } from "@/lib/challenge-platform-copy";
import { buildPricingHref } from "@/lib/pricing-nav";
import { hasEliteAccess } from "@/lib/subscription";

export default async function ChallengeRulesPage({
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

  const detailPath = `/dashboard/challenges/${slug}/rules`;
  if (!profile || !hasEliteAccess(profile)) {
    redirect(buildPricingHref(detailPath));
  }

  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));
  const challenge = await getChallengeBySlug(slug, profile.gender);
  if (!challenge) notFound();

  const challengeCopy = resolveChallengePlatformCopy(platform.challenges, challenge);

  if (isFlashChallenge(challenge)) {
    return (
      <FlashChallengeRulesClient
        copy={challengeCopy}
        challengeTitle={challenge.title}
        backHref={`/dashboard/challenges/${slug}`}
      />
    );
  }

  return (
    <PageTransition>
      <ChallengeRulesInstructionsClient
        copy={challengeCopy}
        challengeTitle={challenge.title}
        backHref={`/dashboard/challenges/${slug}`}
        groupSize={challenge.group_size}
        durationMonths={getChallengeDurationMonths(challenge)}
      />
    </PageTransition>
  );
}
