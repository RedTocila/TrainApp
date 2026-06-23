import type { DailyTask } from "@/lib/daily-tasks";

export function enrichWaterTask(
  tasks: DailyTask[],
  waterMl: number,
  waterGoalMl: number
): DailyTask[] {
  return tasks.map((task) => {
    if (task.category !== "water") return task;

    const goal = waterGoalMl;
    const drank = waterMl;
    const metGoal = drank >= goal;

    return {
      ...task,
      label: `Drink ${goal.toLocaleString()} ml water`,
      detail: `${drank.toLocaleString()} / ${goal.toLocaleString()} ml`,
      completed: task.completed || metGoal,
      missed: metGoal || task.completed ? false : task.missed,
    };
  });
}
