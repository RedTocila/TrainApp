"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Mail, Phone } from "lucide-react";
import type { AdminClientRow } from "@/lib/actions/admin-stats";
import {
  getAdminClientsPlatformScores,
  type PlatformScoreEntry,
} from "@/lib/actions/platform-engagement-score";
import {
  CLIENT_SCORE_PERIODS,
  type ClientScorePeriod,
} from "@/lib/client-score-period";
import { ParticipantPlatformScoreRing } from "@/components/participant-platform-score-ring";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SubscriptionFilter = "all" | "subscribed" | "trial" | "none";

const SUBSCRIPTION_FILTERS: {
  id: SubscriptionFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "subscribed", label: "Subscribed" },
  { id: "trial", label: "Free trial" },
  { id: "none", label: "No subscription" },
];

function clientMatchesFilter(
  client: AdminClientRow,
  filter: SubscriptionFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "trial") return client.onFreeTrial;
  if (filter === "subscribed") {
    return client.activeSubscription && !client.onFreeTrial;
  }
  return !client.activeSubscription;
}

export function AdminClientsList({
  clients,
  initialScores,
  lastActivityMap,
  initialPeriod = "30d",
}: {
  clients: AdminClientRow[];
  initialScores: Record<string, PlatformScoreEntry>;
  lastActivityMap: Record<string, string>;
  initialPeriod?: ClientScorePeriod;
}) {
  const [period, setPeriod] = useState<ClientScorePeriod>(initialPeriod);
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<SubscriptionFilter>("all");
  const [scores, setScores] = useState(initialScores);
  const [isPending, startTransition] = useTransition();

  const filterCounts = useMemo(() => {
    let subscribed = 0;
    let trial = 0;
    let none = 0;
    for (const client of clients) {
      if (client.onFreeTrial) trial += 1;
      else if (client.activeSubscription) subscribed += 1;
      else none += 1;
    }
    return {
      all: clients.length,
      subscribed,
      trial,
      none,
    } satisfies Record<SubscriptionFilter, number>;
  }, [clients]);

  const visibleClients = useMemo(
    () => clients.filter((client) => clientMatchesFilter(client, subscriptionFilter)),
    [clients, subscriptionFilter]
  );

  const changePeriod = (next: ClientScorePeriod) => {
    setPeriod(next);
    startTransition(async () => {
      const nextScores = await getAdminClientsPlatformScores(
        clients.map((client) => ({ id: client.id, created_at: client.created_at })),
        next
      );
      setScores(nextScores);
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Subscription
        </p>
        <div className="flex flex-wrap gap-2">
          {SUBSCRIPTION_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubscriptionFilter(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                subscriptionFilter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
              <span className="ml-1.5 tabular-nums opacity-80">
                {filterCounts[item.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Score period
        </p>
        <div className="flex flex-wrap gap-2">
          {CLIENT_SCORE_PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changePeriod(item.id)}
              disabled={isPending}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                period === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visibleClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No clients in this group
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-3", isPending && "opacity-70")}>
          {visibleClients.map((client) => (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              className="block rounded-xl outline-none transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.995]"
            >
              <Card className="transition-colors hover:border-border hover:bg-card/90">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold leading-snug">
                        {client.full_name}
                      </h2>
                      {client.onFreeTrial ? (
                        <>
                          <Badge className="bg-amber-500/15 text-amber-400">
                            Free trial
                          </Badge>
                          <Badge variant="outline">{client.subscriptionLabel}</Badge>
                        </>
                      ) : client.activeSubscription ? (
                        <>
                          <Badge className="bg-green-500/15 text-green-400">
                            Subscribed
                          </Badge>
                          <Badge variant="outline">{client.subscriptionLabel}</Badge>
                        </>
                      ) : (
                        <Badge variant="secondary">No subscription</Badge>
                      )}
                    </div>

                    {(client.email || client.phone) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {client.email ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </span>
                        ) : null}
                        {client.phone ? (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {client.phone}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {!client.email && !client.phone ? (
                      <p className="text-xs text-muted-foreground">
                        No email or phone on file
                      </p>
                    ) : null}

                    <p className="text-sm text-muted-foreground">
                      Joined {format(new Date(client.created_at), "MMM d, yyyy")}
                      {lastActivityMap[client.id] ? (
                        <>
                          {" · "}
                          Last active{" "}
                          {formatDistanceToNow(new Date(lastActivityMap[client.id]), {
                            addSuffix: true,
                          })}
                        </>
                      ) : null}
                    </p>

                    {client.subscriptionExpiresAt && client.activeSubscription ? (
                      <p className="text-xs text-muted-foreground">
                        {client.onFreeTrial
                          ? client.trialDaysLeft != null && client.trialDaysLeft > 0
                            ? `Trial ends in ${client.trialDaysLeft}d · ${format(new Date(client.subscriptionExpiresAt), "MMM d, yyyy")}`
                            : `Trial ends ${format(new Date(client.subscriptionExpiresAt), "MMM d, yyyy")}`
                          : client.subscription_interval === "annual"
                            ? `Expires ${format(new Date(client.subscriptionExpiresAt), "MMM d, yyyy")}`
                            : `Renews ${format(new Date(client.subscriptionExpiresAt), "MMM d, yyyy")}`}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="shrink-0">
                      {scores[client.id] ? (
                        <ParticipantPlatformScoreRing
                          score={scores[client.id]!.score}
                          breakdown={scores[client.id]!.breakdown}
                        />
                      ) : (
                        <div className="h-16 w-16" aria-hidden />
                      )}
                    </div>
                    <ChevronRight
                      className="mb-1 h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
