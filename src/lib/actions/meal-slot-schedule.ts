"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPerSlotScheduleDates,
  slotsWithMealsFromPlan,
} from "@/lib/nutrition-schedule-utils";
import { MEAL_SLOTS } from "@/lib/meal-slots";
import type { Meal, MealSlot, NutritionScheduleConfig } from "@/lib/types";

function revalidateSchedulePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
}

function isMissingRelationError(error: { message?: string } | null): boolean {
  const message = error?.message ?? "";
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    (message.includes("relation") && message.includes("scheduled_meal_slots"))
  );
}

async function upsertNutritionDays(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  planId: string,
  dates: string[]
) {
  if (dates.length === 0) return { error: "No dates to schedule" };

  const dayRows = dates.map((scheduled_date) => ({
    client_id: clientId,
    scheduled_date,
    plan_id: planId,
  }));

  const { error } = await admin.from("scheduled_nutrition_days").upsert(dayRows, {
    onConflict: "client_id,scheduled_date",
  });

  if (error) return { error: error.message };
  return { success: true as const, dayCount: dayRows.length };
}

export async function getActiveMealSlotsForDate(
  clientId: string,
  dateKey: string
): Promise<{ planId: string; slots: MealSlot[] } | null> {
  const supabase = await createClient();

  const { data: slotRows } = await supabase
    .from("scheduled_meal_slots")
    .select("plan_id, slot")
    .eq("client_id", clientId)
    .eq("scheduled_date", dateKey);

  if (slotRows && slotRows.length > 0) {
    const planId = slotRows[0].plan_id as string;
    const slots = slotRows.map((r) => r.slot as MealSlot);
    return { planId, slots };
  }

  const { data: dayRow } = await supabase
    .from("scheduled_nutrition_days")
    .select("plan_id")
    .eq("client_id", clientId)
    .eq("scheduled_date", dateKey)
    .maybeSingle();

  if (!dayRow) return null;

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("plan_id", dayRow.plan_id)
    .order("order_index");

  const slots = slotsWithMealsFromPlan((meals ?? []) as Meal[]);
  return { planId: dayRow.plan_id as string, slots };
}

export async function clearAllClientNutritionSchedule(clientId: string) {
  const admin = createAdminClient();
  await admin.from("scheduled_meal_slots").delete().eq("client_id", clientId);
  await admin.from("scheduled_nutrition_days").delete().eq("client_id", clientId);
  revalidateSchedulePaths();
}

export async function applyMealSlotSchedule(
  clientId: string,
  planId: string,
  config: NutritionScheduleConfig,
  meals?: Meal[]
) {
  const admin = createAdminClient();
  const perSlotDates = buildPerSlotScheduleDates(config);

  await admin
    .from("scheduled_meal_slots")
    .delete()
    .eq("client_id", clientId)
    .eq("plan_id", planId);

  const rows: {
    client_id: string;
    plan_id: string;
    slot: MealSlot;
    scheduled_date: string;
  }[] = [];

  for (const [slot, dates] of Object.entries(perSlotDates) as [MealSlot, string[]][]) {
    for (const scheduled_date of dates) {
      rows.push({ client_id: clientId, plan_id: planId, slot, scheduled_date });
    }
  }

  if (rows.length === 0) return { error: "No meal slots scheduled" };

  const allDates = [...new Set(rows.map((r) => r.scheduled_date))];

  const { error: slotError } = await admin.from("scheduled_meal_slots").upsert(rows, {
    onConflict: "client_id,scheduled_date,slot",
  });

  if (slotError) {
    if (!isMissingRelationError(slotError)) {
      return { error: slotError.message };
    }

    const dayResult = await upsertNutritionDays(admin, clientId, planId, allDates);
    if ("error" in dayResult && dayResult.error) return dayResult;
    revalidateSchedulePaths();
    return { success: true, slotCount: allDates.length, mode: "days_only" as const };
  }

  if (meals) {
    const dayResult = await upsertNutritionDays(admin, clientId, planId, allDates);
    if ("error" in dayResult && dayResult.error) return dayResult;
  }

  revalidateSchedulePaths();
  return { success: true, slotCount: rows.length };
}

/** Personal plans: schedule all slots that have meals on each date */
export async function syncPersonalMealSlotsForDates(
  clientId: string,
  planId: string,
  dates: string[],
  meals: Meal[]
) {
  const slots = slotsWithMealsFromPlan(meals);
  if (slots.length === 0 || dates.length === 0) return { success: true };

  const admin = createAdminClient();

  await admin
    .from("scheduled_meal_slots")
    .delete()
    .eq("client_id", clientId)
    .eq("plan_id", planId);

  const rows: {
    client_id: string;
    plan_id: string;
    slot: MealSlot;
    scheduled_date: string;
  }[] = [];

  for (const scheduled_date of dates) {
    for (const slot of slots) {
      rows.push({ client_id: clientId, plan_id: planId, slot, scheduled_date });
    }
  }

  if (rows.length > 0) {
    const { error: slotError } = await admin.from("scheduled_meal_slots").upsert(rows, {
      onConflict: "client_id,scheduled_date,slot",
    });

    if (slotError && !isMissingRelationError(slotError)) {
      return { error: slotError.message };
    }

    if (slotError && isMissingRelationError(slotError)) {
      const dayResult = await upsertNutritionDays(admin, clientId, planId, dates);
      if ("error" in dayResult && dayResult.error) return dayResult;
    }
  }

  revalidateSchedulePaths();
  return { success: true };
}

export async function clearMealSlotSchedule(clientId: string, planId: string) {
  const supabase = await createClient();
  await supabase
    .from("scheduled_meal_slots")
    .delete()
    .eq("client_id", clientId)
    .eq("plan_id", planId);
  revalidateSchedulePaths();
  return { success: true };
}
