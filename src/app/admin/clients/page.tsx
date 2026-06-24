import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { requireAdmin } from "@/lib/actions/auth";
import { getAdminClientsWithSubscriptions } from "@/lib/actions/admin-stats";
import { getClientsLastActivityMap } from "@/lib/actions/client-activity";
import { AdminClientPendingRequests } from "@/components/admin-client-pending-requests";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone } from "lucide-react";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await getAdminClientsWithSubscriptions();
  const lastActivityMap = await getClientsLastActivityMap(clients.map((c) => c.id));
  const pendingCount = clients.reduce(
    (sum, client) => sum + client.pendingRequests.length,
    0
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Clients</h1>
          <p className="text-muted-foreground">
            Subscriptions, pending plan requests, and client details
          </p>
          {pendingCount > 0 && (
            <p className="mt-1 text-sm text-amber-500">
              {pendingCount} open request{pendingCount === 1 ? "" : "s"} across clients
            </p>
          )}
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No clients yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <Card
                key={client.id}
                className={
                  client.pendingRequests.length > 0
                    ? "border-amber-500/30"
                    : undefined
                }
              >
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <CardTitle className="text-base">{client.full_name}</CardTitle>
                    {client.phone ? (
                      <a
                        href={`sms:${client.phone.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {client.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">No phone on file</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Joined {format(new Date(client.created_at), "MMM d, yyyy")}
                      {lastActivityMap[client.id] && (
                        <>
                          {" · "}
                          Last active{" "}
                          {formatDistanceToNow(new Date(lastActivityMap[client.id]), {
                            addSuffix: true,
                          })}
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {client.activeSubscription ? (
                        <>
                          <Badge className="bg-green-500/15 text-green-400">Subscribed</Badge>
                          <Badge variant="outline">{client.subscriptionLabel}</Badge>
                        </>
                      ) : (
                        <Badge variant="secondary">No subscription</Badge>
                      )}
                    </div>
                    {client.subscriptionExpiresAt && client.activeSubscription && (
                      <p className="text-xs text-muted-foreground">
                        {client.subscription_interval === "annual" ? "Expires" : "Renews"}{" "}
                        {format(new Date(client.subscriptionExpiresAt), "MMM d, yyyy")}
                      </p>
                    )}
                    <AdminClientPendingRequests
                      clientId={client.id}
                      requests={client.pendingRequests}
                    />
                  </div>
                  <Link href={`/admin/clients/${client.id}`} className="shrink-0">
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
