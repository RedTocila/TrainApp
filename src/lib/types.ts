export type UserRole = "admin" | "client";
export type SubscriptionPlanId = "core" | "ai";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";
export type BillingInterval = "monthly" | "annual";
export type PlanRequestType = "workout" | "diet";
export type PlanRequestStatus =
  | "pending"
  | "awaiting_approval"
  | "rejected"
  | "in_progress"
  | "delivered"
  | "implemented"
  | "completed";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealSlot = "breakfast" | "snack_1" | "lunch" | "snack_2" | "dinner";

export interface SlotScheduleConfig {
  enabled: boolean;
  startDate: string;
  weekdays: number[];
  weeks: number;
  extraDates?: string[];
}

export interface NutritionScheduleConfig {
  /** Legacy whole-plan schedule (still supported) */
  startDate?: string;
  weekdays?: number[];
  weeks?: number;
  extraDates?: string[];
  /** Per meal-type schedules */
  slots?: Partial<Record<MealSlot, SlotScheduleConfig>>;
}

export interface ScheduledMealSlotRow {
  id: string;
  client_id: string;
  plan_id: string;
  slot: MealSlot;
  scheduled_date: string;
  created_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  goal: string | null;
  unit_system?: "metric" | "imperial";
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  intake_weight_kg?: number | null;
  vices?: string | null;
  injuries?: string | null;
  medical_conditions?: string | null;
  daily_routine?: string | null;
  work_schedule?: string | null;
  water_goal_ml?: number;
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fat?: number;
  subscription_plan?: SubscriptionPlanId | null;
  subscription_status?: SubscriptionStatus;
  subscription_interval?: BillingInterval | null;
  subscription_expires_at?: string | null;
  created_at: string;
}

export interface PlanRequest {
  id: string;
  client_id: string;
  type: PlanRequestType;
  status: PlanRequestStatus;
  notes: string | null;
  preferences?: string | null;
  payment_order_id?: string | null;
  amount_cents?: number | null;
  delivered_workout_plan_id?: string | null;
  delivered_nutrition_plan_id?: string | null;
  rejected_reason?: string | null;
  approved_at?: string | null;
  delivered_at?: string | null;
  implemented_at?: string | null;
  schedule_config?: NutritionScheduleConfig | null;
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

export interface WorkoutFolder {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  is_personal?: boolean;
  folder_id?: string | null;
  trainer_label?: string | null;
  created_at: string;
}

export interface WorkoutDay {
  id: string;
  plan_id: string;
  day_index: number;
  title: string;
  exercises?: Exercise[];
}

export interface Exercise {
  id: string;
  day_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  image_url?: string | null;
  video_url?: string | null;
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

export interface ScheduledNutritionDay {
  id: string;
  client_id: string;
  scheduled_date: string;
  plan_id: string;
  created_at: string;
  nutrition_plans?: NutritionPlan & { meals?: Meal[] };
}

export interface ScheduledWorkout {
  id: string;
  client_id: string;
  scheduled_date: string;
  plan_id: string;
  day_id: string;
  created_at: string;
  workout_plans?: WorkoutPlan;
  workout_days?: WorkoutDay & { exercises?: Exercise[] };
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
  is_personal?: boolean;
  folder_id?: string | null;
  trainer_label?: string | null;
}

export interface NutritionFolder {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
}

export interface Meal {
  id: string;
  plan_id: string;
  meal_type: MealType;
  slot?: MealSlot | null;
  name: string;
  description?: string | null;
  youtube_url?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
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

export interface DailyMealLog {
  id: string;
  client_id: string;
  date: string;
  meal_type: MealType;
  slot?: MealSlot | null;
  name: string;
  description?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: { name: string; amount?: string }[];
  source_meal_id?: string | null;
  logged_at: string;
}

export interface BodyWeightLog {
  id: string;
  client_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}

export type ProgressPhotoPose = "front" | "back" | "side";

export interface ProgressPhotoSet {
  id: string;
  client_id: string;
  month_key: string;
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDayTask {
  id: string;
  client_id: string;
  date: string;
  title: string;
  completed: boolean;
  order_index: number;
  created_at: string;
}

export interface ClientHabit {
  id: string;
  client_id: string;
  title: string;
  order_index: number;
  time_start: string | null;
  time_end: string | null;
  weekdays: number[];
  repeat_weeks: number;
  schedule_start: string | null;
  created_at: string;
}

export type WorkoutSessionStatus = "in_progress" | "completed" | "cancelled";

export interface WorkoutSession {
  id: string;
  client_id: string;
  plan_id: string | null;
  day_id: string | null;
  scheduled_date: string | null;
  day_title: string | null;
  plan_title: string | null;
  status: WorkoutSessionStatus;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface WorkoutSessionExercise {
  id: string;
  session_id: string;
  exercise_id: string | null;
  name: string;
  target_sets: number;
  target_reps: string;
  order_index: number;
  notes: string | null;
  video_url?: string | null;
  sets?: WorkoutSessionSet[];
}

export interface WorkoutSessionSet {
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
}

export interface ExerciseHistoryEntry {
  exercise_id: string | null;
  name: string;
  sets: { reps: number | null; weight_kg: number | null }[];
  completed_at: string;
}

export type ClassCategory =
  | "Training"
  | "Nutrition"
  | "Recovery"
  | "Mindset"
  | "Science";

export interface FitnessClass {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: ClassCategory;
  cover_image: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  replay_url: string | null;
  published: boolean;
  created_at: string;
}

export interface ClientCardio {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  duration_minutes: number | null;
  created_at: string;
}

export interface ScheduledCardio {
  id: string;
  client_id: string;
  scheduled_date: string;
  cardio_id: string;
  client_cardio?: ClientCardio;
}
