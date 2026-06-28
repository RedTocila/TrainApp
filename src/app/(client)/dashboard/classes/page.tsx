import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getPublishedClasses } from "@/lib/actions/classes";
import { getPublishedChallenges } from "@/lib/actions/challenges";
import { EliteUpgradeGate } from "@/components/elite-upgrade-gate";
import { LiveHubPage } from "@/components/live-hub-page";
import { PageTransition } from "@/components/page-transition";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { PLATFORM_ELITE_NAME } from "@/lib/brand";
import { getPlatformCopy } from "@/lib/platform-copy";
import { hasEliteAccess } from "@/lib/subscription";

export default async function ClassesPage() {
  const profile = await requireClient();
  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));

  if (!hasEliteAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-4">
          <EliteUpgradeGate
            title={`${PLATFORM_ELITE_NAME} required for live sessions`}
            description={platform.classes.upgradeDescriptionShort}
          />
        </div>
      </PageTransition>
    );
  }

  const [classes, challenges] = await Promise.all([
    getPublishedClasses(),
    getPublishedChallenges(),
  ]);

  return (
    <PageTransition>
      <LiveHubPage classes={classes} challenges={challenges} />
    </PageTransition>
  );
}
