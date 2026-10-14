import { registerPlugin } from "@capacitor/core";

export interface HealthStepsResult {
  available: boolean;
  permitted?: boolean;
  steps: number;
}

interface HealthStepsPlugin {
  getSteps(options: { date: string }): Promise<HealthStepsResult>;
}

const HealthSteps = registerPlugin<HealthStepsPlugin>("HealthSteps");

/** Step total for a yyyy-MM-dd day from Apple Health. iOS only. */
export function getHealthSteps(date: string): Promise<HealthStepsResult> {
  return HealthSteps.getSteps({ date });
}
