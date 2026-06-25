import { addMonths, differenceInCalendarDays, format, startOfMonth } from "date-fns";
import type { ProgressPhotoPose } from "@/lib/types";

export const PROGRESS_PHOTO_POSES: {
  pose: ProgressPhotoPose;
  label: string;
}[] = [
  { pose: "front", label: "Front" },
  { pose: "back", label: "Back" },
  { pose: "side", label: "Side" },
];

export function progressMonthKey(date = new Date()): string {
  return format(startOfMonth(date), "yyyy-MM-dd");
}

export function progressMonthFolder(monthKey: string): string {
  return monthKey.slice(0, 7);
}

export function formatProgressMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export function progressSetComplete(set: {
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
}): boolean {
  return Boolean(set.front_path && set.back_path && set.side_path);
}

export function progressSetHasPhotos(set: {
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
}): boolean {
  return Boolean(set.front_path || set.back_path || set.side_path);
}

export function progressCycleEnd(cycleStart: Date): Date {
  return addMonths(cycleStart, 1);
}

export function formatProgressCycleLabel(cycleStart: Date): string {
  const cycleEnd = progressCycleEnd(cycleStart);
  return `${format(cycleStart, "MMM d")} – ${format(cycleEnd, "MMM d, yyyy")}`;
}

export type ProgressPhotoCountdown = {
  label: string;
  urgency: "complete" | "soon" | "normal";
};

type ProgressPhotoSetLike = {
  id: string;
  created_at: string;
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
};

function findAnchorSet(
  sets: ProgressPhotoSetLike[],
  currentSet: ProgressPhotoSetLike | null
): ProgressPhotoSetLike | null {
  if (currentSet && progressSetHasPhotos(currentSet)) return currentSet;
  return sets.find((set) => progressSetHasPhotos(set)) ?? null;
}

export function getProgressPhotoCountdown(options: {
  sets: ProgressPhotoSetLike[];
  currentSet: ProgressPhotoSetLike | null;
  now?: Date;
}): ProgressPhotoCountdown | null {
  const now = options.now ?? new Date();
  const anchorSet = findAnchorSet(options.sets, options.currentSet);
  if (!anchorSet) return null;

  const cycleStart = new Date(anchorSet.created_at);
  const nextDue = progressCycleEnd(cycleStart);
  const daysUntil = differenceInCalendarDays(nextDue, now);
  const dueLabel = format(nextDue, "MMM d");
  const anchorIsCurrent = options.currentSet?.id === anchorSet.id;
  const anchorComplete = progressSetComplete(anchorSet);

  if (anchorIsCurrent && !anchorComplete) {
    if (daysUntil < 0) {
      return { label: "Overdue — finish your photos", urgency: "soon" };
    }
    if (daysUntil === 0) {
      return { label: "Due today — finish your photos", urgency: "soon" };
    }
    if (daysUntil === 1) {
      return { label: "1 day left to finish your photos", urgency: "soon" };
    }
    return {
      label: `${daysUntil} days left to finish your photos`,
      urgency: daysUntil <= 3 ? "soon" : "normal",
    };
  }

  if (daysUntil < 0) {
    return { label: `Next photos overdue · due ${dueLabel}`, urgency: "soon" };
  }
  if (daysUntil === 0) {
    return { label: `Next photos due today · ${dueLabel}`, urgency: "soon" };
  }
  if (daysUntil === 1) {
    return { label: `Next photos in 1 day · ${dueLabel}`, urgency: "normal" };
  }
  return {
    label: `Next photos in ${daysUntil} days · ${dueLabel}`,
    urgency: anchorComplete && anchorIsCurrent ? "complete" : "normal",
  };
}
