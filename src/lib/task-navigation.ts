import type { DailyTask } from "@/lib/daily-tasks";
import {
  DASHBOARD_DAY_NUTRITION_PATH,
  DASHBOARD_DAY_WORKOUT_PATH,
} from "@/lib/dashboard-day-routes";

export interface TaskDestination {
  href: string;
  sectionId: string;
}

export function getTaskDestination(task: DailyTask): TaskDestination {
  switch (task.category) {
    case "workout":
      return {
        href: DASHBOARD_DAY_WORKOUT_PATH,
        sectionId: "dashboard-workout",
      };
    case "nutrition":
      return {
        href: DASHBOARD_DAY_NUTRITION_PATH,
        sectionId: "dashboard-nutrition",
      };
    case "cardio":
      return {
        href: "/dashboard#dashboard-cardio",
        sectionId: "dashboard-cardio",
      };
    case "habits":
      return {
        href: "/dashboard#dashboard-habits",
        sectionId: "dashboard-habits",
      };
    case "water":
      return {
        href: DASHBOARD_DAY_NUTRITION_PATH,
        sectionId: "dashboard-nutrition",
      };
    default:
      return {
        href: "/dashboard",
        sectionId: "dashboard-overview",
      };
  }
}

export function isDashboardDayDetailHref(href: string): boolean {
  return (
    href === DASHBOARD_DAY_NUTRITION_PATH || href === DASHBOARD_DAY_WORKOUT_PATH
  );
}

export function scrollToSection(sectionId: string): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;

  const main = document.querySelector<HTMLElement>(".dashboard-main");
  if (main) {
    const header = main.querySelector<HTMLElement>("header");
    const headerHeight = header?.offsetHeight ?? 0;
    const mainRect = main.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = main.scrollTop + (elRect.top - mainRect.top) - headerHeight - 8;

    main.scrollTo({ top: Math.max(0, targetTop) });
  } else {
    el.scrollIntoView({ block: "start" });
  }

  el.classList.add("section-highlight");
  window.setTimeout(() => el.classList.remove("section-highlight"), 2000);
  return true;
}
