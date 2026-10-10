import { Trophy } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getPublishedChallenges,
  getUserChallengeMemberships,
} from "@/lib/actions/challenges";
import { ChallengesCatalog } from "@/components/challenges-catalog";
import { PageTransition } from "@/components/page-transition";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasEliteAccess } from "@/lib/subscription";

export default async function ChallengesPage() {
  const profile = await requireClient();
  const requiresUpgrade = !hasEliteAccess(profile);
  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));

  const [challenges, memberships] = await Promise.all([
    getPublishedChallenges(profile.gender),
    requiresUpgrade
      ? Promise.resolve({} as Awaited<ReturnType<typeof getUserChallengeMemberships>>)
      : getUserChallengeMemberships(profile.id),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
        <header className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-violet-400" aria-hidden />
          <h1 className="text-lg font-black leading-none">{platform.eliteUpgrade.challenges}</h1>
        </header>
        <ChallengesCatalog
          challenges={challenges}
          memberships={memberships}
          requiresUpgrade={requiresUpgrade}
        />
      </div>
    </PageTransition>
  );
}
