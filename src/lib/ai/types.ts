import type { MealType } from "@/lib/types";
import type { MealIngredient } from "@/lib/meal-utils";

export type AiProvider = "openai" | "anthropic";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface MealAnalysisResult {
  meal_type: MealType;
  name: string;
  description: string;
  confidence: number;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: MealIngredient[];
}

export interface MealSuggestion {
  title: string;
  description: string;
  protein_g: number;
  calories: number;
  reason: string;
}

export interface MacroGap {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface ProgressPrediction {
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  weekly_change_kg: number | null;
  estimated_goal_date: string | null;
  weeks_to_goal: number | null;
  goal_progress_pct: number | null;
  summary: string;
}

export interface CoachScores {
  training: number;
  nutrition: number;
  consistency: number;
}

export interface WeeklyCoachReport {
  period_start: string;
  period_end: string;
  scores: CoachScores;
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}
