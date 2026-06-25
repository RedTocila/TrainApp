import type { CheckoutLocale } from "@/lib/checkout-i18n";
import type { TaskCategory } from "@/lib/daily-tasks";
import type { MealType, ProgressPhotoPose } from "@/lib/types";

const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] as const;

const weekdayLabelsEn: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const weekdayLabelsAl: Record<number, string> = {
  0: "Die",
  1: "Hën",
  2: "Mar",
  3: "Mër",
  4: "Enj",
  5: "Pre",
  6: "Sht",
};

export function getWeekdayOptions(locale: CheckoutLocale) {
  const labels = locale === "en" ? weekdayLabelsEn : weekdayLabelsAl;
  return WEEKDAY_VALUES.map((value) => ({
    value,
    label: labels[value],
  }));
}

const taskCategoryLabelsEn: Record<TaskCategory, string> = {
  workout: "Workout",
  nutrition: "Nutrition",
  cardio: "Cardio",
  habits: "Habits",
  water: "Water",
};

const taskCategoryLabelsAl: Record<TaskCategory, string> = {
  workout: "Stërvitje",
  nutrition: "Ushqim",
  cardio: "Kardio",
  habits: "Zakone",
  water: "Ujë",
};

export function getTaskCategoryLabels(
  locale: CheckoutLocale
): Record<TaskCategory, string> {
  return locale === "en" ? taskCategoryLabelsEn : taskCategoryLabelsAl;
}

const mealTypeLabelsEn: Record<MealType | "all", string> = {
  all: "All",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const mealTypeLabelsAl: Record<MealType | "all", string> = {
  all: "Të gjitha",
  breakfast: "Mëngjes",
  lunch: "Drekë",
  dinner: "Darkë",
  snack: "Snack",
};

export function getMealTypeOptions(locale: CheckoutLocale) {
  const labels = locale === "en" ? mealTypeLabelsEn : mealTypeLabelsAl;
  return (["all", "breakfast", "lunch", "dinner", "snack"] as const).map(
    (value) => ({ value, label: labels[value] })
  );
}

const photoPoseLabelsEn: Record<ProgressPhotoPose, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
};

const photoPoseLabelsAl: Record<ProgressPhotoPose, string> = {
  front: "Përpara",
  back: "Prapa",
  side: "Anash",
};

export function getProgressPhotoPoses(locale: CheckoutLocale) {
  const labels = locale === "en" ? photoPoseLabelsEn : photoPoseLabelsAl;
  return (["front", "back", "side"] as const).map((pose) => ({
    pose,
    label: labels[pose],
  }));
}
