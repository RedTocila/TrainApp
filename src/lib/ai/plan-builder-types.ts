export interface AiWorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
}

export interface AiWorkoutDay {
  title: string;
  exercises: AiWorkoutExercise[];
}

export interface AiGeneratedWorkoutPlan {
  title: string;
  description: string;
  days_per_week: number;
  days: AiWorkoutDay[];
  coach_notes: string[];
}

/** One-off session for a single calendar day. */
export interface AiGeneratedWorkoutDay {
  title: string;
  description: string;
  exercises: AiWorkoutExercise[];
  coach_notes: string[];
}

export interface AiNutritionMeal {
  slot: "breakfast" | "snack_1" | "lunch" | "snack_2" | "dinner";
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: { name: string; amount?: string }[];
}

export interface AiGeneratedNutritionPlan {
  title: string;
  description: string;
  daily_targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: AiNutritionMeal[];
  coach_notes: string[];
}
