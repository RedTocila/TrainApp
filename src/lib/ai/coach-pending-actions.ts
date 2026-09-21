/** Structured actions Coach Alex proposes; serious ones need a Confirm button in chat. */

export type CoachActionKind =
  | "delete_workout_plan"
  | "delete_nutrition_plan"
  | "schedule_workout_plan"
  | "schedule_nutrition_plan"
  | "clear_workout_schedule"
  | "clear_nutrition_schedule"
  | "assign_workout_plan"
  | "assign_nutrition_plan"
  | "update_health_lifestyle";

export type CoachPendingAction = {
  id: string;
  kind: CoachActionKind;
  /** Short card title shown in chat */
  title: string;
  /** One–two line summary of what will happen */
  summary: string;
  confirmLabel?: string;
  cancelLabel?: string;
  payload: Record<string, unknown>;
};

export function createPendingAction(
  kind: CoachActionKind,
  title: string,
  summary: string,
  payload: Record<string, unknown>,
  labels?: { confirmLabel?: string; cancelLabel?: string }
): CoachPendingAction {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    summary,
    confirmLabel: labels?.confirmLabel,
    cancelLabel: labels?.cancelLabel,
    payload,
  };
}

export const SERIOUS_ACTION_KINDS = new Set<CoachActionKind>([
  "delete_workout_plan",
  "delete_nutrition_plan",
  "schedule_workout_plan",
  "schedule_nutrition_plan",
  "clear_workout_schedule",
  "clear_nutrition_schedule",
  "assign_workout_plan",
  "assign_nutrition_plan",
  "update_health_lifestyle",
]);
