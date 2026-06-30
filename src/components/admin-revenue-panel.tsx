"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RevenuePeriod } from "@/lib/actions/admin-stats";

const PERIODS: { id: RevenuePeriod; label: string }[] = [
  { id: "1d", label: "1 day" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

export function AdminRevenuePanel({
  revenue,
}: {
  revenue: {
    period: RevenuePeriod;
    totalCents: number;
    subscriptionCents: number;
    customCents: number;
    orderCount: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = revenue.period;

  const setPeriod = (period: RevenuePeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`/admin?${params.toString()}`);
  };

  const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total revenue</p>
          <p className="text-2xl font-bold">{fmt(revenue.totalCents)}</p>
          <p className="text-xs text-muted-foreground">{revenue.orderCount} orders</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Subscriptions</p>
          <p className="text-2xl font-bold">{fmt(revenue.subscriptionCents)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">One-off purchases</p>
          <p className="text-2xl font-bold">{fmt(revenue.customCents)}</p>
        </div>
      </div>
    </div>
  );
}
