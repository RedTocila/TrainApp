import type { ClientDayTask } from "@/lib/types";

export function groupDayTasksByDate(
  tasks: ClientDayTask[]
): Record<string, ClientDayTask[]> {
  const map: Record<string, ClientDayTask[]> = {};
  for (const task of tasks) {
    if (!map[task.date]) map[task.date] = [];
    map[task.date].push(task);
  }
  for (const date of Object.keys(map)) {
    map[date].sort((a, b) => a.order_index - b.order_index);
  }
  return map;
}

export function getTasksForDate(
  tasksByDate: Record<string, ClientDayTask[]>,
  dateKey: string
): ClientDayTask[] {
  return tasksByDate[dateKey] ?? [];
}
