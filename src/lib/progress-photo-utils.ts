import { format, startOfMonth } from "date-fns";
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
