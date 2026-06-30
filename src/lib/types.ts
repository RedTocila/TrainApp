import type { IntakeResponses } from "@/lib/intake-questionnaire";

export type UserRole = "admin" | "client";
export type SubscriptionPlanId = "core" | "basic" | "ai" | "elite";
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
  preferred_locale?: "al" | "en";
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
  phone?: string | null;
  dismissed_habit_suggestions?: string[];
  intake_responses?: IntakeResponses;
  /** Baseline person identity from first accepted progress photo. */
  progress_photo_identity?: ProgressPhotoIdentity | null;
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
  delivered_nutrition_pdf_path?: string | null;
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
  order_index?: number;
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

export interface GroceryListItem {
  id: string;
  name: string;
  amount: string;
  category?: string;
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
  photo_path?: string | null;
  photo_expires_at?: string | null;
  /** Resolved client-side from photo_path when not expired. */
  photo_url?: string | null;
}

export interface BodyWeightLog {
  id: string;
  client_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}

export type ProgressPhotoPose = "front" | "back" | "side";

export type ProgressPhotoDetectedSubject =
  | "person_fitness_pose"
  | "wrong_pose"
  | "not_a_person"
  | "gender_mismatch"
  | "different_person"
  | "unclear";

export type ProgressPhotoApparentSex = "male" | "female" | "ambiguous" | "unknown";

/** Baseline identity locked from the client's first valid progress photo. */
export interface ProgressPhotoIdentity {
  signature: string;
  apparent_sex: ProgressPhotoApparentSex;
  established_at: string;
  established_from_month_key: string;
  established_from_pose: ProgressPhotoPose;
}

/** Stored JSON from Coach Alex vision review of a single progress photo. */
export interface ProgressPhotoAnalysis {
  valid: boolean;
  expected_pose: ProgressPhotoPose;
  detected_subject: ProgressPhotoDetectedSubject;
  detected_pose?: ProgressPhotoPose | "unknown";
  detected_apparent_sex?: ProgressPhotoApparentSex;
  /** false when baseline exists and photo shows someone else; null when no baseline yet. */
  identity_match?: boolean | null;
  /** Set on first valid photo to establish future identity checks. */
  identity_signature?: string;
  confidence: number;
  rejection_reason?: string;
  /** Coach Alex reply — sarcastic roast when invalid, coaching notes when valid. */
  alex_message: string;
  physique_observations?: string[];
  progress_notes?: string;
  focus_areas?: string[];
  missing_areas?: string[];
  analyzed_at: string;
}

export interface ProgressPhotoSet {
  id: string;
  client_id: string;
  month_key: string;
  front_path: string | null;
  back_path: string | null;
  side_path: string | null;
  front_analysis?: ProgressPhotoAnalysis | null;
  back_analysis?: ProgressPhotoAnalysis | null;
  side_analysis?: ProgressPhotoAnalysis | null;
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
  scheduled_workout_id?: string | null;
  day_title: string | null;
  plan_title: string | null;
  status: WorkoutSessionStatus;
  notes: string | null;
  started_at: string | null;
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
  rest_seconds?: number | null;
  video_url?: string | null;
  image_url?: string | null;
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

export type ChallengeRound = 1 | 2 | 3;

export type ChallengeMemberOutcome =
  | "pending"
  | "advanced"
  | "eliminated"
  | "group_winner"
  | "champion";

export type ChallengeParticipantStatus =
  | "registered"
  | "active"
  | "eliminated"
  | "finalist"
  | "champion";

/** 0=registration, 1=month1, 2=month2, 3=final, 4=completed */
export type ChallengePhase = 0 | 1 | 2 | 3 | 4;

export interface Challenge {
  id: string;
  title: string;
  slug: string;
  description: string;
  scheduled_at: string;
  /** When participants can start joining. Null = open immediately once published. */
  registration_opens_at?: string | null;
  /** When registration ends. Null = closes at scheduled_at. */
  registration_closes_at?: string | null;
  duration_minutes: number;
  /** Total tournament length in months — one Zoom elimination round per month. */
  duration_months: number;
  /** Day-based length when set (e.g. 30-day challenge). */
  duration_days?: number | null;
  /** Cap on active participants; null = unlimited. */
  max_participants?: number | null;
  /** Fixed transformation series — one enrollment per user across these. */
  is_transformation?: boolean;
  /** Long challenges: male or female participant pool. */
  gender?: "male" | "female" | null;
  /** Quick 1–7 day competition with entry fee. */
  is_flash?: boolean;
  /** Entry fee in cents (display-only, e.g. 1000 = €10). */
  entry_fee_cents?: number;
  group_size: number;
  final_zoom_url: string | null;
  champion_participant_id: string | null;
  /** Cents added to the prize pool per registered participant (e.g. 1000 = €10). */
  prize_pool_cents_per_participant: number;
  /** Populated when participant totals are loaded for display. */
  participant_count?: number;
  round_1_zoom_at: string | null;
  round_2_zoom_at: string | null;
  round_3_zoom_at: string | null;
  prize_paid_at: string | null;
  current_phase: ChallengePhase;
  published: boolean;
  created_at: string;
}

export interface ChallengeAnnouncement {
  id: string;
  challenge_id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  display_name: string;
  status: ChallengeParticipantStatus;
  eliminated_round: ChallengeRound | null;
  created_at: string;
  /** Flash challenges: set when entry fee is paid (null = reserved / pending). */
  entry_fee_paid_at?: string | null;
  /** Overall platform engagement 0–100 since registration (admin views). */
  platform_score?: number;
  platform_score_breakdown?: import("@/lib/platform-engagement-score").PlatformScoreBreakdown;
  /** Long challenges: accumulated daily points (0–days*100). */
  challenge_points?: number;
}

export interface ChallengeWaitlistEntry {
  id: string;
  challenge_id: string;
  user_id: string;
  created_at: string;
}

export interface UserSeriesChallengeStatus {
  participant: {
    challenge_id: string;
    challenge_slug: string;
    challenge_title: string;
  } | null;
  waitlist: {
    challenge_id: string;
    challenge_slug: string;
    challenge_title: string;
    position: number;
  } | null;
}

/** @deprecated use UserSeriesChallengeStatus */
export type UserTransformationChallengeStatus = UserSeriesChallengeStatus;

export interface ChallengeGroup {
  id: string;
  challenge_id: string;
  round: ChallengeRound;
  group_number: number;
  zoom_url: string | null;
  scheduled_at: string | null;
  winner_participant_id: string | null;
  created_at: string;
}

export interface ChallengeGroupMember {
  id: string;
  group_id: string;
  participant_id: string;
  outcome: ChallengeMemberOutcome;
}

export interface ChallengeBracketParticipant extends ChallengeParticipant {
  outcome: ChallengeMemberOutcome;
  is_champion: boolean;
  is_group_winner: boolean;
  group_id: string | null;
  group_number: number | null;
  round: ChallengeRound | null;
  /** Flash challenges: admin-entered winning record for this group. */
  performance_value?: number | null;
}

export interface ChallengeBracketGroup extends ChallengeGroup {
  members: ChallengeBracketParticipant[];
  winner: ChallengeBracketParticipant | null;
}

export interface ChallengeBracketData {
  challenge: Challenge;
  participants: ChallengeParticipant[];
  round1Groups: ChallengeBracketGroup[];
  round2Groups: ChallengeBracketGroup[];
  round3Group: ChallengeBracketGroup | null;
  champion: ChallengeParticipant | null;
  currentUserParticipantId: string | null;
  currentPhase: ChallengePhase;
  /** @deprecated use round1Groups */
  groupStage: ChallengeBracketGroup[];
  /** @deprecated use round3Group */
  finalRound: ChallengeBracketGroup | null;
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
