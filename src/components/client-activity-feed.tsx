"use client";

import { format } from "date-fns";
import {
  Apple,
  CheckCircle2,
  Dumbbell,
  Scale,
  Sparkles,
} from "lucide-react";
import type { ClientActivityItem, ClientActivityType } from "@/lib/actions/client-activity";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  ClientActivityType,
  { label: string; icon: typeof Apple; className: string }
> = {
  meal: { label: "Meal", icon: Apple, className: "text-emerald-400 bg-emerald-500/10" },
  workout: { label: "Workout", icon: Dumbbell, className: "text-primary bg-primary/10" },
  weight: { label: "Weight", icon: Scale, className: "text-sky-400 bg-sky-500/10" },
  habit: { label: "Habit", icon: CheckCircle2, className: "text-amber-400 bg-amber-500/10" },
  task: { label: "Task", icon: Sparkles, className: "text-violet-400 bg-violet-500/10" },
};

export function ClientActivityFeed({
  items,
  showClientName = false,
  emptyMessage = "No activity recorded yet",
}: {
  items: ClientActivityItem[];
  showClientName?: boolean;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const meta = TYPE_META[item.type];
        const Icon = meta.icon;
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                meta.className
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {meta.label}
                </Badge>
              </div>
              {showClientName && item.clientName && (
                <p className="mt-0.5 text-xs font-medium text-primary">{item.clientName}</p>
              )}
              {item.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {format(new Date(item.occurredAt), "MMM d, yyyy · h:mm a")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
