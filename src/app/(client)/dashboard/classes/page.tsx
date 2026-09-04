import { requireClient } from "@/lib/actions/auth";
import { getPublishedClasses } from "@/lib/actions/classes";
import {
  getPublishedChallenges,
  getUserChallengeMemberships,
} from "@/lib/actions/challenges";
import { LiveHubPage } from "@/components/live-hub-page";
import { PageTransition } from "@/components/page-transition";
import { hasEliteAccess } from "@/lib/subscription";

export default async function ClassesPage() {
  const profile = await requireClient();
  const requiresUpgrade = !hasEliteAccess(profile);

  const [classes, challenges, memberships] = await Promise.all([
    getPublishedClasses(),
    getPublishedChallenges(profile.gender),
    requiresUpgrade
      ? Promise.resolve({} as Awaited<ReturnType<typeof getUserChallengeMemberships>>)
      : getUserChallengeMemberships(profile.id),
  ]);

  return (
    <PageTransition>
      <LiveHubPage
        classes={classes}
        challenges={challenges}
        memberships={memberships}
        requiresUpgrade={requiresUpgrade}
      />
    </PageTransition>
  );
}
