import type { CheckoutLocale } from "@/lib/checkout-i18n";
import type { IntakeResponses } from "@/lib/intake-questionnaire";
import { getPlatformCopy } from "@/lib/platform-copy";
import type { ReminderPushMessage } from "@/lib/reminder-message";

const NONE = new Set(["none", "no", "n/a", "na", "jo", "asnje", "asnjë"]);

function cleanPoint(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (NONE.has(text.toLowerCase())) return null;
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export type DayReportFacts = {
  workoutDue: boolean;
  workoutOpen: boolean;
  mealsOpen: boolean;
  waterShort: boolean;
};

/** Injury areas, health conditions, and medication notes worth a morning nudge. */
export function highRiskPoints(input: {
  locale: CheckoutLocale;
  intake?: IntakeResponses | null;
  injuries?: string | null;
  medicalConditions?: string | null;
}): string[] {
  const labels = getPlatformCopy(input.locale).reminders.reports;
  const points: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const text = cleanPoint(value);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    points.push(text);
  };

  for (const area of input.intake?.injury_areas ?? []) {
    if (area === "none") continue;
    push(labels.areas[area] ?? area);
  }
  push(input.intake?.injury_details);
  for (const condition of input.intake?.health_conditions ?? []) {
    if (condition === "none") continue;
    push(labels.conditions[condition] ?? condition);
  }
  push(input.intake?.health_condition_details);
  push(input.intake?.medications);

  if (points.length === 0) {
    push(input.injuries);
    push(input.medicalConditions);
  }
  return points;
}

export function dailyReportMessage(
  locale: CheckoutLocale,
  facts: DayReportFacts
): ReminderPushMessage {
  const copy = getPlatformCopy(locale).reminders.reports;
  const workout = !facts.workoutDue
    ? copy.restDay
    : facts.workoutOpen
      ? copy.workoutOpen
      : copy.workoutDone;
  const meals = facts.mealsOpen ? copy.mealsMissing : copy.mealsLogged;
  const water = facts.waterShort ? copy.waterShort : copy.waterOk;
  return {
    title: copy.dailyTitle,
    body: `${workout}. ${meals}. ${water}.`,
    path: "/dashboard",
  };
}

export function weeklyReportMessage(locale: CheckoutLocale): ReminderPushMessage {
  const copy = getPlatformCopy(locale).reminders.reports;
  return {
    title: copy.weeklyTitle,
    body: copy.weeklyBody,
    path: "/dashboard/ai/reports",
  };
}

export function highRiskMessage(
  locale: CheckoutLocale,
  points: string[]
): ReminderPushMessage | null {
  if (points.length === 0) return null;
  const copy = getPlatformCopy(locale).reminders.reports;
  const listed = points.slice(0, 4).join(", ");
  return {
    title: copy.highRiskTitle,
    body: copy.highRiskBody(listed),
    path: "/dashboard",
  };
}
