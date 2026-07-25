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
import { DeleteClientAccountButton } from "@/components/delete-client-account-button";
import { ParticipantPlatformScoreRing } from "@/components/participant-platform-score-ring";
import { Card, CardContent } from "@/components/ui/card";
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
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold leading-snug">{client.full_name}</h2>
                  {client.onFreeTrial ? (
                    <>
                      <Badge className="bg-amber-500/15 text-amber-400">Free trial</Badge>
                      <Badge variant="outline">{client.subscriptionLabel}</Badge>
                    </>
                  ) : client.activeSubscription ? (
                    <>
                      <Badge className="bg-green-500/15 text-green-400">Subscribed</Badge>
                      <Badge variant="outline">{client.subscriptionLabel}</Badge>
                    </>
                  ) : (
                    <Badge variant="secondary">No subscription</Badge>
                  )}
                </div>

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

              <div className="flex shrink-0 items-center gap-4 sm:gap-5">
                {scores[client.id] ? (
                  <ParticipantPlatformScoreRing
                    score={scores[client.id]!.score}
                    breakdown={scores[client.id]!.breakdown}
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0" aria-hidden />
                )}

                <div className="flex flex-col gap-2 sm:min-w-[7.5rem]">
                  <Link href={`/admin/clients/${client.id}`} className="w-full">
                    <Button size="sm" variant="outline" className="w-full">
                      View
                    </Button>
                  </Link>
                  <DeleteClientAccountButton
                    clientId={client.id}
                    clientName={client.full_name}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
