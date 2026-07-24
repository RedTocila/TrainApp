import { addMonths, differenceInCalendarDays, format, startOfMonth } from "date-fns";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { formatLocalized } from "@/lib/date-locale";
import { getPlatformCopy } from "@/lib/platform-copy";
import type { ProgressPhotoPose } from "@/lib/types";

export const PROGRESS_PHOTO_POSES: {
  pose: ProgressPhotoPose;
  label: string;
}[] = [
  { pose: "front", label: "Front" },
  { pose: "back", label: "Back" },
  { pose: "side", label: "Side" },
];

export function normalizeMonthKey(value: string): string {
  return value.slice(0, 10);
}

export function progressMonthKey(date = new Date()): string {
  return format(startOfMonth(date), "yyyy-MM-dd");
}

export function progressMonthFolder(monthKey: string): string {
  return monthKey.slice(0, 7);
}

export function formatProgressMonthLabel(
  monthKey: string,
  locale: CheckoutLocale = "en"
): string {
  const [year, month] = monthKey.split("-").map(Number);
  return formatLocalized(new Date(year, month - 1, 1), "MMMM yyyy", locale);
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

export function formatProgressCycleLabel(
  cycleStart: Date,
  locale: CheckoutLocale = "en"
): string {
  const cycleEnd = progressCycleEnd(cycleStart);
  return `${formatLocalized(cycleStart, "MMM d", locale)} – ${formatLocalized(cycleEnd, "MMM d, yyyy", locale)}`;
}

/** True while the client may still replace or remove photos for a cycle. */
export function isProgressPhotoCycleOpen(
  cycleStart: Date | string,
  now = new Date()
): boolean {
  const start =
    typeof cycleStart === "string" ? new Date(cycleStart) : cycleStart;
  const cycleEnd = progressCycleEnd(start);
  return differenceInCalendarDays(cycleEnd, now) >= 0;
}

export type ProgressPhotoCountdown = {
  label: string;
  urgency: "complete" | "soon" | "normal";
};

type ProgressPhotoSetLike = {
  id: string;
  month_key: string;
  created_at: string;
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
};

export function getProgressPhotoCountdown(options: {
  sets: ProgressPhotoSetLike[];
  currentSet: ProgressPhotoSetLike | null;
  now?: Date;
  locale?: CheckoutLocale;
}): ProgressPhotoCountdown | null {
  const now = options.now ?? new Date();
  const locale = options.locale ?? "en";
  const photos = getPlatformCopy(locale).photos;
  const anchorSet = findAnchorSet(options.sets, options.currentSet);
  if (!anchorSet) return null;

  const cycleStart = new Date(anchorSet.created_at);
  const nextDue = progressCycleEnd(cycleStart);
  const daysUntil = differenceInCalendarDays(nextDue, now);
  const dueLabel = formatLocalized(nextDue, "MMM d", locale);
  const anchorIsCurrent = options.currentSet?.id === anchorSet.id;
  const anchorComplete = progressSetComplete(anchorSet);

  if (anchorIsCurrent && !anchorComplete) {
    if (daysUntil < 0) {
      return { label: photos.overdueFinish, urgency: "soon" };
    }
    if (daysUntil === 0) {
      return { label: photos.dueTodayFinish, urgency: "soon" };
    }
    if (daysUntil === 1) {
      return { label: photos.oneDayLeft, urgency: "soon" };
    }
    return {
      label: photos.daysLeft(daysUntil),
      urgency: daysUntil <= 3 ? "soon" : "normal",
    };
  }

  if (daysUntil < 0) {
    return { label: photos.nextOverdue(dueLabel), urgency: "soon" };
  }
  if (daysUntil === 0) {
    return { label: photos.nextDueToday(dueLabel), urgency: "soon" };
  }
  if (daysUntil === 1) {
    return { label: photos.nextInOneDay(dueLabel), urgency: "normal" };
  }
  return {
    label: photos.nextInDays(daysUntil, dueLabel),
    urgency: anchorComplete && anchorIsCurrent ? "complete" : "normal",
  };
}

function findAnchorSet<T extends ProgressPhotoSetLike>(
  sets: T[],
  currentSet: ProgressPhotoSetLike | null
): T | null {
  if (currentSet && progressSetHasPhotos(currentSet)) {
    return (
      sets.find((set) => set.id === currentSet.id) ??
      sets.find(
        (set) =>
          normalizeMonthKey(set.month_key) === normalizeMonthKey(currentSet.month_key)
      ) ??
      (currentSet as T)
    );
  }
  return sets.find((set) => progressSetHasPhotos(set)) ?? null;
}

/** Set whose photos should appear on the dashboard card. */
export function getProgressPhotoDisplaySet<T extends ProgressPhotoSetLike>(
  sets: T[],
  now = new Date()
): T | null {
  const currentMonth = progressMonthKey(now);
  const currentSet =
    sets.find((set) => normalizeMonthKey(set.month_key) === currentMonth) ?? null;
  return findAnchorSet(sets, currentSet);
}

export type ProgressPhotoTimelineRow = {
  monthKey: string;
  set: ProgressPhotoSetLike | null;
  title: string;
  subtitle?: string;
  /** Can add photos to empty slots. */
  canUpload: boolean;
  /** Can replace or remove existing photos. */
  canModify: boolean;
  isUpcoming: boolean;
  isComplete: boolean;
};

/** Logged months (newest first), optional active cycle, plus one empty next check-in row. */
export function getProgressPhotoTimelineRows(
  sets: ProgressPhotoSetLike[],
  now = new Date(),
  locale: CheckoutLocale = "en"
): ProgressPhotoTimelineRow[] {
  const currentMonth = progressMonthKey(now);
  const setsByMonth = new Map(sets.map((set) => [set.month_key, set]));
  const currentSet = setsByMonth.get(currentMonth) ?? null;
  const anchor = findAnchorSet(sets, currentSet);
  const countdown = getProgressPhotoCountdown({ sets, currentSet, now, locale });

  const loggedRows: ProgressPhotoTimelineRow[] = [...sets]
    .filter((set) => progressSetHasPhotos(set) && progressSetComplete(set))
    .sort((a, b) => b.month_key.localeCompare(a.month_key))
    .map((set) => ({
      monthKey: set.month_key,
      set,
      title:
        set.month_key === currentMonth
          ? formatProgressCycleLabel(new Date(set.created_at), locale)
          : formatProgressMonthLabel(set.month_key, locale),
      canUpload: false,
      canModify: isProgressPhotoCycleOpen(set.created_at, now),
      isUpcoming: false,
      isComplete: true,
    }));

  const activeCycleOpen =
    currentSet && isProgressPhotoCycleOpen(currentSet.created_at, now);

  const activeRow: ProgressPhotoTimelineRow | null =
    currentSet && progressSetHasPhotos(currentSet) && !progressSetComplete(currentSet)
      ? {
          monthKey: currentMonth,
          set: currentSet,
          title: formatProgressCycleLabel(new Date(currentSet.created_at), locale),
          subtitle: countdown?.label,
          canUpload: Boolean(activeCycleOpen),
          canModify: Boolean(activeCycleOpen),
          isUpcoming: false,
          isComplete: false,
        }
      : null;

  const anchorComplete = anchor ? progressSetComplete(anchor) : false;
  const nextCycleStart = anchor
    ? progressCycleEnd(new Date(anchor.created_at))
    : startOfMonth(now);
  const daysUntil = differenceInCalendarDays(nextCycleStart, now);

  const nextCanUpload =
    !anchor || (anchorComplete && daysUntil <= 0 && !activeRow);

  const nextTitle = !anchor
    ? formatProgressMonthLabel(currentMonth, locale)
    : formatProgressCycleLabel(nextCycleStart, locale);

  const nextRow: ProgressPhotoTimelineRow = {
    monthKey: progressMonthKey(nextCycleStart),
    set: null,
    title: nextTitle,
    subtitle: countdown?.label,
    canUpload: nextCanUpload,
    canModify: false,
    isUpcoming: true,
    isComplete: false,
  };

  return [...loggedRows, ...(activeRow ? [activeRow] : []), nextRow];
}
