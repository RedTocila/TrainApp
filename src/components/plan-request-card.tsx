"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { updateRequestStatus } from "@/lib/actions/requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanRequest } from "@/lib/types";

export function PlanRequestCard({ request }: { request: PlanRequest & { profiles?: { full_name: string } } }) {
  const [isPending, startTransition] = useTransition();

  const builderHref =
    request.type === "workout"
      ? `/admin/workouts/new?client=${request.client_id}&request=${request.id}`
      : `/admin/nutrition/new?client=${request.client_id}&request=${request.id}`;

  return (
    <motion.div whileHover={{ scale: 1.01 }}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              {request.profiles?.full_name ?? "Client"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(request.created_at), "MMM d, yyyy · h:mm a")}
            </p>
          </div>
          <Badge variant={request.status === "pending" ? "warning" : "secondary"}>
            {request.status}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {request.type} plan
          </Badge>
          {request.notes && (
            <p className="w-full text-sm text-muted-foreground">{request.notes}</p>
          )}
          <div className="mt-2 flex w-full gap-2">
            <Link href={`/admin/clients/${request.client_id}?request=${request.id}`}>
              <Button variant="outline" size="sm">
                View Client
              </Button>
            </Link>
            {request.status === "pending" && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void updateRequestStatus(request.id, "in_progress");
                  })
                }
              >
                Start Building
              </Button>
            )}
            <Link href={builderHref}>
              <Button size="sm" variant="secondary">
                Build Plan <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
