import type { ClassCategory, FitnessClass } from "@/lib/types";

export const CLASS_CATEGORIES: ClassCategory[] = [
  "Training",
  "Nutrition",
  "Recovery",
  "Mindset",
  "Science",
];

export type ClassStatus = "upcoming" | "live" | "replay" | "ended";

export const categoryStyles: Record<
  ClassCategory,
  { badge: string; glow: string; gradient: string }
> = {
  Training: {
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    glow: "shadow-orange-500/20",
    gradient: "from-orange-600 via-amber-600 to-red-700",
  },
  Nutrition: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    glow: "shadow-emerald-500/20",
    gradient: "from-emerald-600 via-teal-600 to-green-800",
  },
  Recovery: {
    badge: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    glow: "shadow-violet-500/20",
    gradient: "from-violet-600 via-purple-600 to-indigo-800",
  },
  Mindset: {
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    glow: "shadow-rose-500/20",
    gradient: "from-rose-600 via-pink-600 to-fuchsia-800",
  },
  Science: {
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    glow: "shadow-sky-500/20",
    gradient: "from-sky-600 via-blue-600 to-cyan-800",
  },
};

export function getClassStatus(fitnessClass: FitnessClass, now = new Date()): ClassStatus {
  if (fitnessClass.replay_url) return "replay";

  const start = new Date(fitnessClass.scheduled_at);
  const end = new Date(start.getTime() + fitnessClass.duration_minutes * 60_000);

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "ended";
}

export function canJoinLive(fitnessClass: FitnessClass, now = new Date()): boolean {
  if (!fitnessClass.meeting_url) return false;
  const status = getClassStatus(fitnessClass, now);
  if (status === "live") return true;
  if (status !== "upcoming") return false;

  const start = new Date(fitnessClass.scheduled_at);
  const joinOpens = new Date(start.getTime() - 15 * 60_000);
  return now >= joinOpens;
}

export function classExcerpt(description: string, maxLength = 140): string {
  const plain = description.replace(/[#*_\n]/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
}

export function partitionClasses(classes: FitnessClass[]) {
  const live: FitnessClass[] = [];
  const upcoming: FitnessClass[] = [];
  const replays: FitnessClass[] = [];
  const ended: FitnessClass[] = [];

  for (const fitnessClass of classes) {
    const status = getClassStatus(fitnessClass);
    if (status === "live") live.push(fitnessClass);
    else if (status === "upcoming") upcoming.push(fitnessClass);
    else if (status === "replay") replays.push(fitnessClass);
    else ended.push(fitnessClass);
  }

  const byScheduledDesc = (a: FitnessClass, b: FitnessClass) =>
    new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();

  live.sort(byScheduledDesc);
  upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  replays.sort(byScheduledDesc);
  ended.sort(byScheduledDesc);

  return { live, upcoming, replays, ended };
}
