import { requireAdmin } from "@/lib/actions/auth";
import { getAdminClientsWithSubscriptions } from "@/lib/actions/admin-stats";
import { getClientsLastActivityMap } from "@/lib/actions/client-activity";
import { getAdminClientsPlatformScores } from "@/lib/actions/platform-engagement-score";
import { AdminClientsList } from "@/components/admin-clients-list";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientScorePeriod } from "@/lib/client-score-period";

const VALID_PERIODS: ClientScorePeriod[] = ["1d", "7d", "30d", "90d", "6m", "1y", "all"];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period: periodParam } = await searchParams;
  const period: ClientScorePeriod = VALID_PERIODS.includes(periodParam as ClientScorePeriod)
    ? (periodParam as ClientScorePeriod)
    : "30d";

  const clients = await getAdminClientsWithSubscriptions();
  const [lastActivityMap, platformScores] = await Promise.all([
    getClientsLastActivityMap(clients.map((c) => c.id)),
    getAdminClientsPlatformScores(
      clients.map((c) => ({ id: c.id, created_at: c.created_at })),
      period
    ),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Clients</h1>
          <p className="text-muted-foreground">Subscriptions and client details</p>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No clients yet
            </CardContent>
          </Card>
        ) : (
          <AdminClientsList
            clients={clients}
            initialScores={platformScores}
            lastActivityMap={lastActivityMap}
            initialPeriod={period}
          />
        )}
      </div>
    </PageTransition>
  );
}
