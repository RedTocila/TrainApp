import Link from "next/link";
import { requireClient } from "@/lib/actions/auth";
import { getClientProgressSummary } from "@/lib/actions/client-progress";
import {
  Camera,
  ChartNoAxesCombined,
  Flame,
  Scale,
  UserRound,
} from "lucide-react";

export default async function ProgressPage() {
  const profile = await requireClient();
  const summary = await getClientProgressSummary(profile.id);
  const firstName = profile.full_name?.split(" ")[0] ?? "Athlete";

  const cards = [
    {
      label: "Workouts completed",
      value: String(summary.workoutsCompleted),
      hint: `${summary.workoutsThisWeek} this week`,
      icon: ChartNoAxesCombined,
    },
    {
      label: "Current streak",
      value: `${summary.streakDays}`,
      hint: summary.streakDays === 1 ? "day" : "days",
      icon: Flame,
    },
    {
      label: "Latest weight",
      value:
        summary.latestWeightKg != null
          ? `${summary.latestWeightKg.toFixed(1)} kg`
          : "—",
      hint:
        summary.weightDeltaKg != null
          ? `${summary.weightDeltaKg > 0 ? "+" : ""}${summary.weightDeltaKg.toFixed(1)} kg (90d)`
          : `${summary.weightEntries} logs`,
      icon: Scale,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-5 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Progress
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">
          Keep going, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A simple look at consistency, body metrics, and photos.
        </p>
      </header>

      <div className="grid gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 px-4 py-4"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="text-xl font-black tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2.5">
        <Link
          href="/dashboard/progress-photos"
          className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <Camera className="h-5 w-5 text-primary" />
          Progress photos
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <UserRound className="h-5 w-5 text-primary" />
          Profile & health data
        </Link>
        <Link
          href="/dashboard/ai"
          className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <Flame className="h-5 w-5 text-primary" />
          Ask AI Coach about progress
        </Link>
      </div>
    </div>
  );
}
