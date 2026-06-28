/** Shared Supabase column lists — keeps payloads small and consistent. */

/** Minimal profile fields for subscription / access gates — avoids failing when optional columns are not migrated yet. */
export const SUBSCRIPTION_ACCESS_COLUMNS =
  "id, role, subscription_plan, subscription_status, subscription_expires_at";

export const PROFILE_COLUMNS =
  "id, role, full_name, avatar_url, goal, preferred_locale, age, gender, height_cm, intake_weight_kg, vices, injuries, medical_conditions, daily_routine, work_schedule, water_goal_ml, target_calories, target_protein, target_carbs, target_fat, subscription_plan, subscription_status, subscription_interval, subscription_expires_at, phone, dismissed_habit_suggestions, intake_responses, created_at";

export const CLIENT_HABIT_COLUMNS =
  "id, client_id, title, order_index, time_start, time_end, weekdays, repeat_weeks, schedule_start, created_at";

export const CLIENT_DAY_TASK_COLUMNS =
  "id, client_id, date, title, completed, order_index, created_at";

export const WORKOUT_SESSION_COLUMNS =
  "id, client_id, plan_id, day_id, scheduled_date, scheduled_workout_id, day_title, plan_title, status, notes, started_at, completed_at, created_at";

export const WORKOUT_SESSION_EXERCISE_COLUMNS =
  "id, session_id, exercise_id, name, target_sets, target_reps, order_index, notes";

export const WORKOUT_SESSION_SET_COLUMNS =
  "id, session_exercise_id, set_number, reps, weight_kg, completed";

export const MEAL_COLUMNS =
  "id, plan_id, meal_type, slot, name, description, youtube_url, calories, protein, carbs, fat, foods, order_index";

export const NOTIFICATION_COLUMNS =
  "id, user_id, type, title, body, metadata, read, created_at";

export const WORKOUT_PLAN_LIST_COLUMNS =
  "id, title, description, created_by, is_personal, folder_id, trainer_label, created_at";

export const NUTRITION_PLAN_LIST_COLUMNS =
  "id, title, description, target_calories, target_protein, target_carbs, target_fat, created_by, is_personal, folder_id, trainer_label, created_at";

export const WORKOUT_DAY_WITH_EXERCISES =
  "id, plan_id, day_index, title, exercises(id, day_id, name, sets, reps, rest_seconds, notes, image_url, video_url, order_index)";
