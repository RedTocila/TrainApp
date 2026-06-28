import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getChallengeBySlug } from "@/lib/actions/challenges";
import { ChallengeRulesInstructionsClient } from "@/components/challenge-rules-instructions-client";
import { EliteUpgradeGate } from "@/components/elite-upgrade-gate";
import { PageTransition } from "@/components/page-transition";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { PLATFORM_ELITE_NAME } from "@/lib/brand";
import { getChallengeDurationMonths } from "@/lib/challenge-utils";
import { getPlatformCopy } from "@/lib/platform-copy";
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

  return (
    <ChallengeRulesInstructionsClient
      copy={platform.challenges}
      challengeTitle={challenge.title}
      backHref={`/dashboard/challenges/${slug}`}
      groupSize={challenge.group_size}
      durationMonths={getChallengeDurationMonths(challenge)}
    />
  );
}
