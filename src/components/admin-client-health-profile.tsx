"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, HeartPulse } from "lucide-react";
import type { ClientIntakeInfo } from "@/lib/actions/client-intake";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import { buildFullIntakeSummary } from "@/lib/intake-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminClientHealthProfile({
  intake,
}: {
  intake: ClientIntakeInfo | null;
}) {
  const [open, setOpen] = useState(false);

  if (!intake) {
    return (
      <Card>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 font-bold">
            <HeartPulse className="h-4 w-4 text-primary" />
            Health profile
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {open ? (
          <CardContent className="border-t border-border/60 pt-4">
            <p className="text-sm text-muted-foreground">
              Could not load this client&apos;s health profile.
            </p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  const { profile, latestWeightKg, goalLabel } = intake;
  const complete = isClientIntakeComplete(profile);
  const items = buildFullIntakeSummary(profile);
  const hasMacros =
    profile.target_calories != null ||
    profile.target_protein != null ||
    profile.target_carbs != null ||
    profile.target_fat != null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <HeartPulse className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-bold">Health profile</span>
          {complete ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Complete
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Incomplete
            </Badge>
          )}
          {goalLabel ? (
            <span className="truncate text-sm text-muted-foreground">· {goalLabel}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <CardContent className="space-y-4 border-t border-border/60 pt-4">
          {(latestWeightKg != null || hasMacros) && (
            <div className="flex flex-wrap gap-2">
              {latestWeightKg != null ? (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest weight
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{latestWeightKg} kg</p>
                </div>
              ) : null}
              {profile.target_calories != null ? (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Calories
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(Number(profile.target_calories))} kcal
                  </p>
                </div>
              ) : null}
              {profile.target_protein != null ? (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Protein
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(Number(profile.target_protein))} g
                  </p>
                </div>
              ) : null}
              {profile.target_carbs != null ? (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Carbs
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(Number(profile.target_carbs))} g
                  </p>
                </div>
              ) : null}
              {profile.target_fat != null ? (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fat
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(Number(profile.target_fat))} g
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/50 bg-card/60 px-2.5 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug whitespace-pre-wrap">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No health profile answers yet. Ask the client to complete their profile.
            </p>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
