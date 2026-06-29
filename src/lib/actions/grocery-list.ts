"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/actions/auth-client";
import { MEAL_COLUMNS } from "@/lib/db-selects";
import {
  buildWeeklyGroceryListFromMeals,
  groceryWeekKey,
  normalizeGroceryList,
  resolveGroceryWeekKey,
} from "@/lib/grocery-list-utils";
import type { GroceryListItem, Meal } from "@/lib/types";

async function readGroceryChecks(
  admin: SupabaseClient,
  clientId: string,
  planId: string,
  weekKey: string
): Promise<string[]> {
  const { data } = await admin
    .from("client_grocery_checks")
    .select("checked_ids")
    .eq("client_id", clientId)
    .eq("plan_id", planId)
    .eq("week_key", weekKey)
    .maybeSingle();

  const ids = data?.checked_ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

export async function getWeeklyGroceryList(
  clientId: string,
  planId: string
): Promise<{ items: GroceryListItem[]; weekKey: string } | { error: string }> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) return { error: auth.error };

  const weekKey = groceryWeekKey();

  const { data: plan, error: planError } = await auth.admin
    .from("nutrition_plans")
    .select("grocery_list")
    .eq("id", planId)
    .maybeSingle();

  if (planError) return { error: planError.message };

  const stored = normalizeGroceryList(plan?.grocery_list);
  if (stored.length > 0) {
    return { items: stored, weekKey };
  }

  const { data: meals, error: mealsError } = await auth.admin
    .from("meals")
    .select(MEAL_COLUMNS)
    .eq("plan_id", planId)
    .order("order_index");

  if (mealsError) return { error: mealsError.message };

  return {
    items: buildWeeklyGroceryListFromMeals((meals ?? []) as Meal[]),
    weekKey,
  };
}

export async function getGroceryChecks(
  clientId: string,
  planId: string,
  weekKey?: string
): Promise<string[]> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) return [];

  const key = resolveGroceryWeekKey(weekKey);
  return readGroceryChecks(auth.admin, clientId, planId, key);
}

export async function toggleGroceryCheck(
  clientId: string,
  planId: string,
  itemId: string,
  checked: boolean,
  weekKey?: string
): Promise<{ checkedIds: string[] } | { error: string }> {
  const auth = await requireOwnedClient(clientId);
  if ("error" in auth) return { error: auth.error };

  const key = resolveGroceryWeekKey(weekKey);
  const current = await readGroceryChecks(auth.admin, clientId, planId, key);
  const next = checked
    ? [...new Set([...current, itemId])]
    : current.filter((id) => id !== itemId);

  const { error } = await auth.admin.from("client_grocery_checks").upsert(
    {
      client_id: clientId,
      plan_id: planId,
      week_key: key,
      checked_ids: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,plan_id,week_key" }
  );

  if (error) return { error: error.message };

  return { checkedIds: next };
}

export async function savePlanGroceryList(
  planId: string,
  items: GroceryListItem[]
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("nutrition_plans")
    .update({ grocery_list: items })
    .eq("id", planId)
    .eq("created_by", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/day/nutrition");
  return { success: true };
}
