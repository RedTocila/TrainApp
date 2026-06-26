import type { DailyTask } from "@/lib/daily-tasks";

export interface TaskDestination {
  href: string;
  sectionId: string;
}

export function getTaskDestination(task: DailyTask): TaskDestination {
  switch (task.category) {
    case "workout":
      return {
        href: "/dashboard/workout",
        sectionId: "dashboard-workout",
      };
    case "nutrition":
      if (task.id.endsWith("-nutrition-pending")) {
        return {
          href: "/dashboard/nutrition",
          sectionId: "dashboard-nutrition",
        };
      }
      return {
        href: "/dashboard#dashboard-nutrition",
        sectionId: "dashboard-nutrition",
      };
    case "cardio":
      return {
        href: "/dashboard/workout/cardio",
        sectionId: "dashboard-cardio",
      };
    case "habits":
      return {
        href: `/dashboard#${task.id}`,
        sectionId: task.id,
      };
    case "water":
      return {
        href: "/dashboard#dashboard-water",
        sectionId: "dashboard-water",
      };
    default:
      return {
        href: "/dashboard",
        sectionId: "dashboard-overview",
      };
  }
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
