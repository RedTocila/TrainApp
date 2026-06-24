import type { BodyWeightLog } from "@/lib/types";
import type { ProgressPrediction } from "@/lib/ai/types";
import { formatDateKey } from "@/lib/utils";

export function computeProgressPrediction(
  weightHistory: BodyWeightLog[],
  goalWeightKg: number | null | undefined
): ProgressPrediction {
  if (weightHistory.length === 0) {
    return {
      current_weight_kg: null,
      goal_weight_kg: goalWeightKg ?? null,
      weekly_change_kg: null,
      estimated_goal_date: null,
      weeks_to_goal: null,
      goal_progress_pct: null,
      summary: "Log weight regularly to unlock progress predictions.",
    };
  }

  const sorted = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const current = Number(sorted[sorted.length - 1]!.weight_kg);
  const goal = goalWeightKg != null ? Number(goalWeightKg) : null;

  let weeklyChange: number | null = null;
  if (sorted.length >= 2) {
    const recent = sorted.slice(-Math.min(4, sorted.length));
    const first = Number(recent[0]!.weight_kg);
    const last = Number(recent[recent.length - 1]!.weight_kg);
    const days = Math.max(
      1,
      (new Date(recent[recent.length - 1]!.date).getTime() -
        new Date(recent[0]!.date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    weeklyChange = ((last - first) / days) * 7;
    weeklyChange = Math.round(weeklyChange * 100) / 100;
  }

  let weeksToGoal: number | null = null;
  let estimatedDate: string | null = null;
  let progressPct: number | null = null;

  if (goal != null && weeklyChange != null && Math.abs(weeklyChange) > 0.05) {
    const remaining = goal - current;
    weeksToGoal = Math.abs(remaining / weeklyChange);
    weeksToGoal = Math.round(weeksToGoal * 10) / 10;
    const target = new Date();
    target.setDate(target.getDate() + Math.round(weeksToGoal * 7));
    estimatedDate = formatDateKey(target);

    const start = Number(sorted[0]!.weight_kg);
    const totalDelta = goal - start;
    if (Math.abs(totalDelta) > 0.1) {
      progressPct = Math.min(
        100,
        Math.max(0, Math.round(((start - current) / (start - goal)) * 100))
      );
    }
  }

  let summary = `Current weight: ${current} kg.`;
  if (weeklyChange != null) {
    summary += ` Trend: ${weeklyChange > 0 ? "+" : ""}${weeklyChange} kg/week.`;
  }
  if (estimatedDate && goal != null) {
    summary += ` Estimated goal date: ${estimatedDate}.`;
  }

  return {
    current_weight_kg: current,
    goal_weight_kg: goal,
    weekly_change_kg: weeklyChange,
    estimated_goal_date: estimatedDate,
    weeks_to_goal: weeksToGoal,
    goal_progress_pct: progressPct,
    summary,
  };
}
