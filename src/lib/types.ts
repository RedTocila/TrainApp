export type UserRole = "admin" | "client";
export type PlanRequestType = "workout" | "diet";
export type PlanRequestStatus = "pending" | "in_progress" | "completed";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface PlanRequest {
  id: string;
  client_id: string;
  type: PlanRequestType;
  status: PlanRequestStatus;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface WorkoutDay {
  id: string;
  plan_id: string;
  day_index: number;
  title: string;
}

export interface Exercise {
  id: string;
  day_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  order_index: number;
}

export interface WorkoutAssignment {
  id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  active: boolean;
  workout_plans?: WorkoutPlan & { workout_days?: (WorkoutDay & { exercises?: Exercise[] })[] };
}

export interface NutritionPlan {
  id: string;
  title: string;
  description: string | null;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  created_by: string;
  created_at: string;
}

export interface Meal {
  id: string;
  plan_id: string;
  meal_type: MealType;
  name: string;
  foods: { name: string; amount?: string }[];
  order_index: number;
}

export interface NutritionAssignment {
  id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  active: boolean;
  nutrition_plans?: NutritionPlan & { meals?: Meal[] };
}

export interface DailyLog {
  id: string;
  client_id: string;
  date: string;
  water_ml: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string | null;
  published: boolean;
  created_at: string;
}
