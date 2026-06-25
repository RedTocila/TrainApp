"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MealType } from "@/lib/types";

export async function createWorkoutPlan(title: string, description?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("workout_plans")
    .insert({ title, description, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function saveWorkoutDay(
  planId: string,
  dayIndex: number,
  title: string,
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
    image_url?: string;
    video_url?: string;
  }[],
  dayId?: string
) {
  const supabase = await createClient();

  let targetDayId = dayId;
  if (!targetDayId) {
    const { data: day, error } = await supabase
      .from("workout_days")
      .insert({ plan_id: planId, day_index: dayIndex, title })
      .select()
      .single();
    if (error) return { error: error.message };
    targetDayId = day.id;
  } else {
    await supabase.from("workout_days").update({ title, day_index: dayIndex }).eq("id", targetDayId);
    await supabase.from("exercises").delete().eq("day_id", targetDayId);
  }

  if (exercises.length > 0) {
    const { error } = await supabase.from("exercises").insert(
      exercises.map((ex, i) => ({
        day_id: targetDayId!,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes ?? null,
        image_url: ex.image_url ?? null,
        video_url: ex.video_url ?? null,
        order_index: i,
      }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/workouts/${planId}/edit`);
  revalidatePath(`/dashboard/workout`);
  revalidatePath(`/dashboard/workout/${planId}/edit`);
  return { success: true, dayId: targetDayId };
}

export async function assignWorkoutPlan(clientId: string, planId: string, requestId?: string) {
  const supabase = await createClient();

  await supabase
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error } = await supabase.from("workout_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };

  if (requestId) {
    await supabase.from("plan_requests").update({ status: "completed" }).eq("id", requestId);
  }

  await supabase.rpc("notify_user", {
    p_user_id: clientId,
    p_type: "plan_assigned",
    p_title: "Your workout plan is ready",
    p_body: "Your coach has assigned your personalized workout plan.",
    p_metadata: { plan_id: planId, type: "workout" },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createNutritionPlan(data: {
  title: string;
  description?: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: plan, error } = await supabase
    .from("nutrition_plans")
    .insert({ ...data, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: plan };
}

export async function updateNutritionPlan(
  planId: string,
  data: {
    title: string;
    description?: string;
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_plans").update(data).eq("id", planId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/nutrition/${planId}/edit`);
  return { success: true };
}

export async function saveMeal(
  planId: string,
  meal: {
    meal_type: MealType;
    slot?: string | null;
    name: string;
    description?: string | null;
    youtube_url?: string | null;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    foods: { name: string; amount?: string }[];
    order_index: number;
  },
  mealId?: string
) {
  const supabase = await createClient();
  const payload = {
    meal_type: meal.meal_type,
    slot: meal.slot ?? null,
    name: meal.name,
    description: meal.description?.trim() || null,
    youtube_url: meal.youtube_url?.trim() || null,
    calories: meal.calories ?? null,
    protein: meal.protein ?? null,
    carbs: meal.carbs ?? null,
    fat: meal.fat ?? null,
    foods: meal.foods,
    order_index: meal.order_index,
  };

  if (mealId) {
    const { error } = await supabase
      .from("meals")
      .update(payload)
      .eq("id", mealId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("meals").insert({ plan_id: planId, ...payload });
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/nutrition/${planId}/edit`);
  revalidatePath(`/dashboard/nutrition/${planId}/edit`);
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMeal(mealId: string, planId: string) {
  const supabase = await createClient();
  await supabase.from("meals").delete().eq("id", mealId);
  revalidatePath(`/admin/nutrition/${planId}/edit`);
  revalidatePath(`/dashboard/nutrition/${planId}/edit`);
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard");
}

export async function assignNutritionPlan(clientId: string, planId: string, requestId?: string) {
  const supabase = await createClient();

  await supabase
    .from("nutrition_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error } = await supabase.from("nutrition_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };

  if (requestId) {
    await supabase.from("plan_requests").update({ status: "completed" }).eq("id", requestId);
  }

  await supabase.rpc("notify_user", {
    p_user_id: clientId,
    p_type: "plan_assigned",
    p_title: "Your nutrition plan is ready",
    p_body: "Your coach has assigned your personalized diet plan.",
    p_metadata: { plan_id: planId, type: "diet" },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getWorkoutPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_plans")
    .select("id, title, description, created_by, is_personal, folder_id, trainer_label, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getNutritionPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nutrition_plans")
    .select(
      "id, title, description, target_calories, target_protein, target_carbs, target_fat, created_by, is_personal, folder_id, trainer_label, created_at"
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getWorkoutPlanWithDetails(planId: string) {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, title, description, created_by, is_personal, folder_id, trainer_label, created_at")
    .eq("id", planId)
    .single();
  const { data: days } = await supabase
    .from("workout_days")
    .select(
      "id, plan_id, day_index, title, exercises(id, day_id, name, sets, reps, rest_seconds, notes, image_url, video_url, order_index)"
    )
    .eq("plan_id", planId)
    .order("day_index");
  return { plan, days: days ?? [] };
}

export async function getNutritionPlanWithDetails(planId: string) {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select(
      "id, title, description, target_calories, target_protein, target_carbs, target_fat, created_by, is_personal, folder_id, trainer_label, created_at"
    )
    .eq("id", planId)
    .single();
  const { data: meals } = await supabase
    .from("meals")
    .select(
      "id, plan_id, meal_type, slot, name, description, youtube_url, calories, protein, carbs, fat, foods, order_index"
    )
    .eq("plan_id", planId)
    .order("order_index");
  return { plan, meals: meals ?? [] };
}

export async function getClientWorkoutAssignment(clientId: string) {
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("workout_assignments")
    .select(
      "id, client_id, plan_id, start_date, active, workout_plans(id, title, description, created_by, is_personal, folder_id, trainer_label, created_at)"
    )
    .eq("client_id", clientId)
    .eq("active", true)
    .maybeSingle();

  if (!assignment?.workout_plans) return assignment as any;

  const rawPlan = (assignment as any).workout_plans;
  const workoutPlan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as any;
  if (!workoutPlan) return assignment as any;

  const { data: days } = await supabase
    .from("workout_days")
    .select(
      "id, plan_id, day_index, title, exercises(id, day_id, name, sets, reps, rest_seconds, notes, image_url, video_url, order_index)"
    )
    .eq("plan_id", assignment.plan_id)
    .order("day_index");

  return {
    ...assignment,
    workout_plans: {
      ...workoutPlan,
      workout_days: days ?? [],
    },
  };
}

export async function getClientNutritionAssignment(clientId: string) {
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("nutrition_assignments")
    .select(
      "id, client_id, plan_id, start_date, active, nutrition_plans(id, title, description, target_calories, target_protein, target_carbs, target_fat, created_by, is_personal, folder_id, trainer_label, created_at)"
    )
    .eq("client_id", clientId)
    .eq("active", true)
    .maybeSingle();

  if (!assignment?.nutrition_plans) return assignment as any;

  const rawPlan = (assignment as any).nutrition_plans;
  const nutritionPlan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as any;
  if (!nutritionPlan) return assignment as any;

  const { data: meals } = await supabase
    .from("meals")
    .select(
      "id, plan_id, meal_type, slot, name, description, youtube_url, calories, protein, carbs, fat, foods, order_index"
    )
    .eq("plan_id", assignment.plan_id)
    .order("order_index");

  return {
    ...assignment,
    nutrition_plans: {
      ...nutritionPlan,
      meals: meals ?? [],
    },
  };
}

export async function getAllClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, full_name, avatar_url, goal, unit_system, age, gender, height_cm, intake_weight_kg, vices, injuries, medical_conditions, daily_routine, work_schedule, water_goal_ml, target_calories, target_protein, target_carbs, target_fat, subscription_plan, subscription_status, subscription_interval, subscription_expires_at, phone, dismissed_habit_suggestions, intake_responses, created_at"
    )
    .eq("role", "client")
    .order("created_at", { ascending: false });
  return data ?? [];
}
