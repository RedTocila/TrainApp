"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [scores, setScores] = useState(initialScores);
  const [isPending, startTransition] = useTransition();

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

      <div className={cn("space-y-3", isPending && "opacity-70")}>
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
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
              </div>
              <div className="relative flex shrink-0 items-center justify-end sm:w-24 sm:justify-center">
                <Link href={`/admin/clients/${client.id}`} className="absolute right-0 top-0">
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </Link>
                {scores[client.id] ? (
                  <ParticipantPlatformScoreRing
                    score={scores[client.id]!.score}
                    breakdown={scores[client.id]!.breakdown}
                    className="mt-10 sm:mt-0"
                  />
                ) : null}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
