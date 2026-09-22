"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { confirmCoachPendingAction } from "@/lib/actions/coach-commands";
import type { CoachPendingAction } from "@/lib/ai/coach-pending-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DESTRUCTIVE_KINDS = new Set([
  "delete_workout_plan",
  "delete_nutrition_plan",
  "clear_workout_schedule",
  "clear_nutrition_schedule",
  "delete_habit",
  "delete_cardio",
  "clear_cardio_schedule",
]);

export function ChatActionConfirmCard({
  action,
  onResolved,
}: {
  action: CoachPendingAction;
  onResolved?: (status: "confirmed" | "cancelled") => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "confirmed" | "cancelled">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const destructive = DESTRUCTIVE_KINDS.has(action.kind);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmCoachPendingAction(action);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus("confirmed");
      setMessage(result.message);
      onResolved?.("confirmed");
      router.refresh();
    });
  };

  const handleCancel = () => {
    setStatus("cancelled");
    onResolved?.("cancelled");
  };

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3",
        destructive
          ? "border-red-500/40 bg-red-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            destructive ? "text-red-400" : "text-amber-400"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Confirm with Alex
          </p>
          <p className="mt-0.5 font-semibold text-foreground">{action.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{action.summary}</p>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          {status === "confirmed" ? (
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-400">
              <Check className="h-3.5 w-3.5" />
              {message ?? "Done"}
            </p>
          ) : status === "cancelled" ? (
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Cancelled</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className={cn(
                  "h-8",
                  destructive && "bg-red-600 text-white hover:bg-red-500"
                )}
                disabled={isPending}
                onClick={handleConfirm}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Working…
                  </>
                ) : (
                  action.confirmLabel ?? "Confirm"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={isPending}
                onClick={handleCancel}
              >
                <X className="h-3.5 w-3.5" />
                {action.cancelLabel ?? "Cancel"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
