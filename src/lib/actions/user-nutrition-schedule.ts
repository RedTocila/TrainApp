"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateRecurringScheduleDates,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import type { Meal, MealSlot, ScheduledNutritionDay } from "@/lib/types";
import { syncPersonalMealSlotsForDates } from "@/lib/actions/meal-slot-schedule";
import { slotsWithMealsFromPlan } from "@/lib/nutrition-schedule-utils";

export type MealPlanViewKind = "ai" | "personal";

export interface MealPlanForDate {
  title: string;
  meals: Meal[];
  scheduled: boolean;
  planId: string;
  activeSlots?: MealSlot[];
  kind: MealPlanViewKind;
}

function inferMealPlanKind(description?: string | null, title?: string | null): MealPlanViewKind {
  const text = `${description ?? ""} ${title ?? ""}`.toLowerCase();
  if (text.includes("ai coach")) return "ai";
  return "personal";
}

function buildMealPlanForDate(
  plan: { title: string; description?: string | null },
  meals: Meal[],
  planId: string,
  scheduled: boolean,
  activeSlots?: MealSlot[]
): MealPlanForDate | null {
  if (meals.length === 0) return null;
  return {
    title: plan.title,
    meals,
    scheduled,
    planId,
    activeSlots,
    kind: inferMealPlanKind(plan.description, plan.title),
  };
}

async function getActivePersonalAssignmentPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<MealPlanForDate | null> {
  const { data: assignment } = await supabase
    .from("nutrition_assignments")
    .select("plan_id, nutrition_plans(title, description, is_personal)")
    .eq("client_id", clientId)
    .eq("active", true)
    .maybeSingle();

  const plan = assignment?.nutrition_plans as
    | { title: string; description?: string | null; is_personal?: boolean }
    | null
    | undefined;

  if (!assignment || !plan?.is_personal) return null;

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("plan_id", assignment.plan_id)
    .order("order_index");

  return buildMealPlanForDate(
    plan,
    (meals ?? []) as Meal[],
    assignment.plan_id,
    false,
    slotsWithMealsFromPlan((meals ?? []) as Meal[])
  );
}

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

function revalidateSchedulePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
}

export async function scheduleNutritionDays(planId: string, dates: string[]) {
  if (dates.length === 0) return { error: "Pick at least one date" };

  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Day menu not found" };

  const rows = dates.map((scheduled_date) => ({
    client_id: userId,
    scheduled_date,
    plan_id: planId,
  }));

  const { error } = await supabase.from("scheduled_nutrition_days").upsert(rows, {
    onConflict: "client_id,scheduled_date",
  });

  if (error) return { error: error.message };

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("plan_id", planId)
    .order("order_index");

  await syncPersonalMealSlotsForDates(
    userId,
    planId,
    dates,
    (meals ?? []) as Meal[]
  );

  revalidateSchedulePaths();
  return { success: true, count: dates.length };
}

export async function scheduleNutritionSeries({
  startDate,
  weekdays,
  weeks,
  planId,
}: {
  startDate: string;
  weekdays: number[];
  weeks: number;
  planId: string;
}) {
  const dates = generateRecurringScheduleDates(
    new Date(startDate + "T12:00:00"),
    weekdays,
    weeks
  );
  return scheduleNutritionDays(planId, dates);
}

export async function replaceNutritionSchedule(payload: {
  startDate: string;
  weekdays: number[];
  weeks: number;
  planId: string;
}) {
  const { supabase, userId } = await requireUserId();

  await supabase
    .from("scheduled_nutrition_days")
    .delete()
    .eq("client_id", userId)
    .eq("plan_id", payload.planId);

  return scheduleNutritionSeries(payload);
}

export async function clearNutritionSchedule(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("scheduled_nutrition_days")
    .delete()
    .eq("client_id", userId)
    .eq("plan_id", planId);

  if (error) return { error: error.message };
  revalidateSchedulePaths();
  return { success: true };
}

export async function unscheduleNutritionDay(scheduledDate: string) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("scheduled_nutrition_days")
    .delete()
    .eq("client_id", userId)
    .eq("scheduled_date", scheduledDate);

  if (error) return { error: error.message };
  revalidateSchedulePaths();
  return { success: true };
}

export async function getScheduledNutritionInRange(from: string, to: string) {
  const { supabase, userId } = await requireUserId();

  const { data } = await supabase
    .from("scheduled_nutrition_days")
    .select("*, nutrition_plans(*, meals(*))")
    .eq("client_id", userId)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

  return (data ?? []) as ScheduledNutritionDay[];
}

export async function getNutritionScheduleForPlan(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data } = await supabase
    .from("scheduled_nutrition_days")
    .select("scheduled_date")
    .eq("client_id", userId)
    .eq("plan_id", planId)
    .order("scheduled_date");

  return (data ?? []).map((r) => r.scheduled_date as string);
}

export async function getScheduledNutritionDatesByPlan() {
  const { supabase, userId } = await requireUserId();

  const { data } = await supabase
    .from("scheduled_nutrition_days")
    .select("plan_id, scheduled_date")
    .eq("client_id", userId)
    .order("scheduled_date");

  const byPlan: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const planId = row.plan_id as string;
    if (!byPlan[planId]) byPlan[planId] = [];
    byPlan[planId].push(row.scheduled_date as string);
  }
  return byPlan;
}

export async function getNutritionPlanForDate(
  clientId: string,
  dateKey: string
): Promise<MealPlanForDate | null> {
  const supabase = await createClient();

  const { data: slotRows } = await supabase
    .from("scheduled_meal_slots")
    .select("plan_id, slot")
    .eq("client_id", clientId)
    .eq("scheduled_date", dateKey);

  if (slotRows && slotRows.length > 0) {
    const planId = slotRows[0].plan_id as string;
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("title, description, is_personal")
      .eq("id", planId)
      .single();

    if (plan?.is_personal) {
      const activeSlots = slotRows.map((r) => r.slot as MealSlot);
      const { data: meals } = await supabase
        .from("meals")
        .select("*")
        .eq("plan_id", planId)
        .order("order_index");

      const result = buildMealPlanForDate(
        plan,
        (meals ?? []) as Meal[],
        planId,
        true,
        activeSlots
      );
      if (result) return result;
    }
  }

  const { data: scheduled } = await supabase
    .from("scheduled_nutrition_days")
    .select("plan_id, nutrition_plans(title, description, is_personal, meals(*))")
    .eq("client_id", clientId)
    .eq("scheduled_date", dateKey)
    .maybeSingle();

  if (scheduled?.nutrition_plans) {
    const rawPlan = scheduled.nutrition_plans;
    const plan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as {
      title: string;
      description?: string | null;
      is_personal?: boolean;
      meals?: Meal[];
    } | null | undefined;

    if (plan?.is_personal) {
      const meals = [...(plan.meals ?? [])].sort((a, b) => a.order_index - b.order_index);
      const result = buildMealPlanForDate(
        plan,
        meals,
        scheduled.plan_id as string,
        true,
        slotsWithMealsFromPlan(meals)
      );
      if (result) return result;
    }
  }

  return getActivePersonalAssignmentPlan(supabase, clientId);
}
