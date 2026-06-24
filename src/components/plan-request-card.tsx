"use client";

import { useTransition, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { updateRequestStatus } from "@/lib/actions/requests";
import {
  approvePlanRequest,
  rejectPlanRequest,
} from "@/lib/actions/custom-plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanRequest } from "@/lib/types";

function statusVariant(status: string) {
  if (status === "awaiting_approval") return "warning" as const;
  if (status === "delivered" || status === "implemented" || status === "completed") {
    return "default" as const;
  }
  if (status === "rejected") return "warning" as const;
  return "secondary" as const;
}

function statusLabel(status: string) {
  if (status === "delivered") return "Sent to client";
  if (status === "implemented" || status === "completed") return "Done";
  return status.replace(/_/g, " ");
}

export function PlanRequestCard({
  request,
}: {
  request: PlanRequest & { profiles?: { full_name: string } };
}) {
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);

  const builderHref =
    request.type === "workout"
      ? `/admin/workouts/new?client=${request.client_id}&request=${request.id}`
      : `/admin/nutrition/new?client=${request.client_id}&request=${request.id}`;

  const isPaid = !!request.payment_order_id;
  const priceLabel = request.amount_cents
    ? `€${(request.amount_cents / 100).toFixed(0)}`
    : null;

  return (
    <motion.div whileHover={{ scale: 1.01 }}>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {request.profiles?.full_name ?? "Client"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(request.created_at), "MMM d, yyyy · h:mm a")}
              {priceLabel && ` · ${priceLabel} paid`}
            </p>
          </div>
          <Badge variant={statusVariant(request.status)}>
            {statusLabel(request.status)}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {request.type} plan
          </Badge>
          {isPaid && <Badge className="bg-green-500/15 text-green-400">Paid</Badge>}
          {(request.preferences || request.notes) && (
            <p className="w-full text-sm text-muted-foreground">
              {request.preferences ?? request.notes}
            </p>
          )}
          <div className="mt-2 flex w-full flex-wrap gap-2">
            <Link href={`/admin/clients/${request.client_id}?request=${request.id}`}>
              <Button variant="outline" size="sm">
                View Client
              </Button>
            </Link>
            {request.status === "awaiting_approval" && (
              <>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void approvePlanRequest(request.id);
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void rejectPlanRequest(request.id);
                    })
                  }
                >
                  Reject & refund
                </Button>
              </>
            )}
            {request.status === "pending" && !isPaid && (
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
            {["in_progress", "awaiting_approval", "pending"].includes(request.status) && (
              <Link href={builderHref}>
                <Button size="sm" variant="secondary">
                  {request.type === "diet" ? "Upload PDF & send" : "Build & send"}{" "}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            )}
            {request.status === "delivered" && (
              <Badge className="bg-green-500/15 text-green-400">Done — sent to client</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
