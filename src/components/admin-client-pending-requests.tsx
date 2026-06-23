import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { PlanRequest } from "@/lib/types";

function statusVariant(status: string) {
  if (status === "awaiting_approval") return "warning" as const;
  if (status === "delivered" || status === "implemented" || status === "completed") {
    return "default" as const;
  }
  if (status === "in_progress") return "secondary" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  if (status === "delivered") return "Sent to client";
  if (status === "implemented" || status === "completed") return "Done";
  return status.replace(/_/g, " ");
}

function typeLabel(type: PlanRequest["type"]) {
  return type === "workout" ? "Workout plan" : "Nutrition plan";
}

export function AdminClientPendingRequests({
  clientId,
  requests,
}: {
  clientId: string;
  requests: PlanRequest[];
}) {
  if (requests.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
        Pending
      </p>
      <ul className="space-y-2">
        {requests.map((request) => {
          const preview = request.preferences ?? request.notes;
          const priceLabel = request.amount_cents
            ? `€${(request.amount_cents / 100).toFixed(0)}`
            : null;

          return (
            <li key={request.id}>
              <Link
                href={`/admin/clients/${clientId}?request=${request.id}`}
                className="block rounded-md p-2 transition-colors hover:bg-secondary/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{typeLabel(request.type)}</span>
                  <Badge variant={statusVariant(request.status)} className="capitalize">
                    {statusLabel(request.status)}
                  </Badge>
                  {priceLabel && (
                    <Badge variant="outline" className="text-green-400">
                      {priceLabel} paid
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(request.created_at), "MMM d")}
                  </span>
                </div>
                {preview && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {preview}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
