"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSubscribedUserAccess } from "@/lib/actions/user-access";
import { UNCATEGORIZED_NUTRITION_FOLDER_ID } from "@/lib/nutrition-folders";
import { mealPayloadFromForm, normalizeMealMacros, type MealFormData } from "@/lib/meal-utils";
import { mealTypeForSlot, sumDayMenuMacros, type MealSlot } from "@/lib/meal-slots";
import type { Meal, MealType, NutritionPlan } from "@/lib/types";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

async function requireMutationUserId() {
  const access = await requireSubscribedUserAccess();
  if ("error" in access) throw new Error(access.error);
  return { supabase: access.supabase, userId: access.userId };
}

function revalidateNutritionPaths(folderId?: string | null, planId?: string) {
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard/nutrition/meals");
  revalidatePath("/dashboard");
  if (planId) {
    revalidatePath(`/dashboard/nutrition/${planId}/edit`);
  }
  if (folderId) {
    revalidatePath(`/dashboard/nutrition/folder/${folderId}`);
  }
  revalidatePath(`/dashboard/nutrition/folder/${UNCATEGORIZED_NUTRITION_FOLDER_ID}`);
}

async function syncDayMenuMacrosFromMeals(planId: string) {
  const { supabase, userId } = await requireUserId();
  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("plan_id", planId);

  const totals = sumDayMenuMacros((meals ?? []) as Meal[]);
  await supabase
    .from("nutrition_plans")
    .update({
      target_calories: totals.calories,
      target_protein: totals.protein,
      target_carbs: totals.carbs,
      target_fat: totals.fat,
    })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);
}

async function nextSlotOrderIndex(planId: string, slot: MealSlot) {
  const { supabase } = await requireUserId();
  const { data: last } = await supabase
    .from("meals")
    .select("order_index")
    .eq("plan_id", planId)
    .eq("slot", slot)
    .order("order_index", { ascending: false })
    .limit(1);
  return (last?.[0]?.order_index ?? -1) + 1;
}

export async function createPersonalNutritionPlan(
  title: string,
  description?: string,
  macros?: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
  },
  folderId?: string | null
) {
  const { supabase, userId } = await requireMutationUserId();

  const resolvedFolderId =
    folderId && folderId !== UNCATEGORIZED_NUTRITION_FOLDER_ID ? folderId : null;

  if (resolvedFolderId) {
    const { data: folder } = await supabase
      .from("nutrition_folders")
      .select("id")
      .eq("id", resolvedFolderId)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data, error } = await supabase
    .from("nutrition_plans")
    .insert({
      title,
      description: description ?? null,
      target_calories: macros?.target_calories ?? 2000,
      target_protein: macros?.target_protein ?? 150,
      target_carbs: macros?.target_carbs ?? 200,
      target_fat: macros?.target_fat ?? 65,
      created_by: userId,
      is_personal: true,
      folder_id: resolvedFolderId,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidateNutritionPaths(resolvedFolderId);
  return { data };
}

export async function updatePersonalNutritionPlanMacros(
  planId: string,
  macros: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
  }
) {
  const { supabase, userId } = await requireUserId();

  const { data: plan, error } = await supabase
    .from("nutrition_plans")
    .update({
      target_calories: macros.target_calories,
      target_protein: macros.target_protein,
      target_carbs: macros.target_carbs,
      target_fat: macros.target_fat,
    })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidateNutritionPaths(plan?.folder_id, planId);
  return { data: plan };
}

export async function updatePersonalNutritionPlan(
  planId: string,
  data: {
    title: string;
    description?: string | null;
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
  }
) {
  const { supabase, userId } = await requireUserId();

  const { data: plan, error } = await supabase
    .from("nutrition_plans")
    .update({
      title: data.title,
      description: data.description ?? null,
      target_calories: data.target_calories,
      target_protein: data.target_protein,
      target_carbs: data.target_carbs,
      target_fat: data.target_fat,
    })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidateNutritionPaths(plan?.folder_id, planId);
  return { data: plan };
}

export async function getPersonalNutritionPlans(folderId?: string) {
  const { supabase, userId } = await requireUserId();

  let query = supabase
    .from("nutrition_plans")
    .select("*")
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (folderId === UNCATEGORIZED_NUTRITION_FOLDER_ID) {
    query = query.is("folder_id", null);
  } else if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []) as NutritionPlan[];
}

export async function getPersonalNutritionPlanWithDetails(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { plan: null, meals: [] as Meal[] };

  const { data: meals } = await supabase
    .from("meals")
    .select("*")
    .eq("plan_id", planId)
    .order("order_index");

  return { plan: plan as NutritionPlan, meals: (meals ?? []) as Meal[] };
}

export async function deletePersonalNutritionPlan(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  const { error } = await supabase
    .from("nutrition_plans")
    .delete()
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };
  revalidateNutritionPaths(plan?.folder_id as string | null, planId);
  return { success: true };
}

export async function assignPersonalNutritionPlan(planId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Plan not found" };

  await supabase
    .from("nutrition_assignments")
    .update({ active: false })
    .eq("client_id", userId);

  const { error } = await supabase.from("nutrition_assignments").insert({
    client_id: userId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export interface NutritionFolderOverview {
  id: string;
  name: string;
  planCount: number;
  created_at?: string;
}

export async function getNutritionFoldersOverview(): Promise<NutritionFolderOverview[]> {
  const { supabase, userId } = await requireUserId();

  const [{ data: folders }, { data: plans }] = await Promise.all([
    supabase
      .from("nutrition_folders")
      .select("*")
      .eq("client_id", userId)
      .order("created_at"),
    supabase
      .from("nutrition_plans")
      .select("folder_id")
      .eq("created_by", userId)
      .eq("is_personal", true),
  ]);

  const countByFolder = new Map<string | null, number>();
  for (const plan of plans ?? []) {
    const key = plan.folder_id as string | null;
    countByFolder.set(key, (countByFolder.get(key) ?? 0) + 1);
  }

  const result: NutritionFolderOverview[] = (folders ?? []).map((folder) => ({
    id: folder.id,
    name: folder.name,
    planCount: countByFolder.get(folder.id) ?? 0,
    created_at: folder.created_at,
  }));

  const uncategorizedCount = countByFolder.get(null) ?? 0;
  if (uncategorizedCount > 0) {
    result.push({
      id: UNCATEGORIZED_NUTRITION_FOLDER_ID,
      name: "Unfiled",
      planCount: uncategorizedCount,
    });
  }

  return result;
}

export async function getNutritionFolderMeta(folderId: string) {
  if (folderId === UNCATEGORIZED_NUTRITION_FOLDER_ID) {
    return { id: folderId, name: "Unfiled" };
  }

  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("nutrition_folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("client_id", userId)
    .single();

  if (!data) return null;
  return data;
}

export async function createNutritionFolder(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required" };

  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("nutrition_folders")
    .insert({ client_id: userId, name: trimmed })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/nutrition");
  return { data };
}

export async function renameNutritionFolder(folderId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name is required" };

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("nutrition_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .eq("client_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/dashboard/nutrition/folder/${folderId}`);
  return { success: true };
}

export async function deleteNutritionFolder(folderId: string) {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("nutrition_folders")
    .delete()
    .eq("id", folderId)
    .eq("client_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/dashboard/nutrition/folder/${UNCATEGORIZED_NUTRITION_FOLDER_ID}`);
  return { success: true };
}

export async function getNutritionFoldersForMove(): Promise<{ id: string; name: string }[]> {
  const { supabase, userId } = await requireUserId();

  const { data: folders } = await supabase
    .from("nutrition_folders")
    .select("id, name")
    .eq("client_id", userId)
    .order("created_at");

  return [
    { id: UNCATEGORIZED_NUTRITION_FOLDER_ID, name: "Unfiled" },
    ...(folders ?? []).map((folder) => ({ id: folder.id, name: folder.name })),
  ];
}

export async function moveNutritionPlanToFolder(planId: string, targetFolderId: string) {
  const { supabase, userId } = await requireUserId();
  const resolvedTarget =
    targetFolderId === UNCATEGORIZED_NUTRITION_FOLDER_ID ? null : targetFolderId;

  if (resolvedTarget) {
    const { data: folder } = await supabase
      .from("nutrition_folders")
      .select("id")
      .eq("id", resolvedTarget)
      .eq("client_id", userId)
      .single();
    if (!folder) return { error: "Folder not found" };
  }

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Meal plan not found" };

  const oldFolderId = plan.folder_id as string | null;
  if (oldFolderId === resolvedTarget) return { success: true };

  const { error } = await supabase
    .from("nutrition_plans")
    .update({ folder_id: resolvedTarget })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true);

  if (error) return { error: error.message };

  revalidateNutritionPaths(oldFolderId, planId);
  revalidateNutritionPaths(resolvedTarget, planId);
  return { success: true };
}

export interface NutritionPickItem {
  id: string;
  title: string;
  description: string | null;
  currentFolderName: string;
}

export async function getNutritionPlansAvailableForFolder(
  targetFolderId: string
): Promise<NutritionPickItem[]> {
  const { supabase, userId } = await requireUserId();
  const folderOptions = await getNutritionFoldersForMove();
  const folderNameById = new Map(folderOptions.map((f) => [f.id, f.name]));
  const resolvedTarget =
    targetFolderId === UNCATEGORIZED_NUTRITION_FOLDER_ID ? null : targetFolderId;

  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("id, title, description, folder_id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .order("title");

  return (plans ?? [])
    .filter((plan) => (plan.folder_id as string | null) !== resolvedTarget)
    .map((plan) => {
      const folderKey =
        (plan.folder_id as string | null) ?? UNCATEGORIZED_NUTRITION_FOLDER_ID;
      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        currentFolderName: folderNameById.get(folderKey) ?? "Unfiled",
      };
    });
}

export interface PersonalNutritionListItem {
  plan: NutritionPlan;
  meals: Meal[];
  mealCount: number;
}

export async function getPersonalNutritionPlansInFolder(
  folderId?: string
): Promise<PersonalNutritionListItem[]> {
  const plans = await getPersonalNutritionPlans(folderId);
  const items: PersonalNutritionListItem[] = [];

  for (const plan of plans) {
    const { meals } = await getPersonalNutritionPlanWithDetails(plan.id);
    items.push({
      plan,
      meals,
      mealCount: meals.length,
    });
  }

  return items;
}

export async function getActivePersonalNutritionPlanId(): Promise<string | null> {
  const { supabase, userId } = await requireUserId();
  const { data: assignment } = await supabase
    .from("nutrition_assignments")
    .select("plan_id")
    .eq("client_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!assignment) return null;

  const { plan } = await getPersonalNutritionPlanWithDetails(assignment.plan_id);
  return plan ? assignment.plan_id : null;
}

async function getPersonalMealWithPlan(mealId: string) {
  const { supabase, userId } = await requireUserId();

  const { data: meal } = await supabase
    .from("meals")
    .select("*")
    .eq("id", mealId)
    .single();

  if (!meal) return null;

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("id", meal.plan_id)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return null;

  return { meal: meal as Meal, plan: plan as NutritionPlan };
}

export interface PersonalMealLibraryItem {
  meal: Meal;
  planId: string;
  planTitle: string;
  folderId: string;
  folderName: string;
}

export async function getPersonalMealsLibrary(): Promise<PersonalMealLibraryItem[]> {
  const { supabase, userId } = await requireUserId();
  const folderOptions = await getNutritionFoldersForMove();
  const folderNameById = new Map(folderOptions.map((f) => [f.id, f.name]));

  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("id, title, folder_id, meals(*)")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .order("created_at", { ascending: false });

  const items: PersonalMealLibraryItem[] = [];

  for (const plan of plans ?? []) {
    const folderKey =
      (plan.folder_id as string | null) ?? UNCATEGORIZED_NUTRITION_FOLDER_ID;
    const folderName = folderNameById.get(folderKey) ?? "Unfiled";
    const meals = ((plan.meals as Meal[]) ?? []).sort(
      (a, b) => a.order_index - b.order_index
    );

    for (const meal of meals) {
      items.push({
        meal,
        planId: plan.id,
        planTitle: plan.title,
        folderId: folderKey,
        folderName,
      });
    }
  }

  return items;
}

export async function getPersonalPlansInFolderForPicker(folderId: string) {
  const plans = await getPersonalNutritionPlans(folderId);
  return plans.map((p) => ({ id: p.id, title: p.title }));
}

export async function updatePersonalMeal(mealId: string, data: MealFormData) {
  const found = await getPersonalMealWithPlan(mealId);
  if (!found) return { error: "Meal not found" };

  const { supabase } = await requireUserId();
  const { error } = await supabase
    .from("meals")
    .update(mealPayloadFromForm(data))
    .eq("id", mealId);

  if (error) return { error: error.message };
  await syncDayMenuMacrosFromMeals(found.plan.id);
  revalidateNutritionPaths(found.plan.folder_id, found.plan.id);
  return { success: true };
}

export async function deletePersonalMeal(mealId: string) {
  const found = await getPersonalMealWithPlan(mealId);
  if (!found) return { error: "Meal not found" };

  const { supabase } = await requireUserId();
  const { error } = await supabase.from("meals").delete().eq("id", mealId);

  if (error) return { error: error.message };
  await syncDayMenuMacrosFromMeals(found.plan.id);
  revalidateNutritionPaths(found.plan.folder_id, found.plan.id);
  return { success: true };
}

export async function addMealToDayMenuSlot(
  planId: string,
  slot: MealSlot,
  data: MealFormData
) {
  const trimmed = data.name.trim();
  if (!trimmed) return { error: "Meal name is required" };

  const { supabase, userId } = await requireUserId();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Day menu not found" };

  const orderIndex = await nextSlotOrderIndex(planId, slot);

  const { error } = await supabase.from("meals").insert({
    plan_id: planId,
    ...mealPayloadFromForm(data),
    slot,
    meal_type: mealTypeForSlot(slot),
    order_index: orderIndex,
  });

  if (error) return { error: error.message };
  await syncDayMenuMacrosFromMeals(planId);
  revalidateNutritionPaths(plan.folder_id as string | null, planId);
  return { success: true };
}

export async function addLibraryMealToSlot(
  planId: string,
  slot: MealSlot,
  libraryMealId: string
) {
  const found = await getPersonalMealWithPlan(libraryMealId);
  if (!found) return { error: "Meal not found" };

  return addMealToDayMenuSlot(planId, slot, {
    meal_type: found.meal.meal_type,
    name: found.meal.name,
    description: found.meal.description ?? "",
    macros: normalizeMealMacros(found.meal),
    ingredients: (found.meal.foods ?? []).map((f) => ({
      name: f.name,
      amount: f.amount ?? "",
    })),
  });
}

export async function reorderSlotMeals(
  planId: string,
  slot: MealSlot,
  orderedMealIds: string[]
) {
  const { supabase, userId } = await requireUserId();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, folder_id")
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Day menu not found" };

  for (let i = 0; i < orderedMealIds.length; i++) {
    const { error } = await supabase
      .from("meals")
      .update({ order_index: i })
      .eq("id", orderedMealIds[i])
      .eq("plan_id", planId)
      .eq("slot", slot);

    if (error) return { error: error.message };
  }

  await syncDayMenuMacrosFromMeals(planId);
  revalidateNutritionPaths(plan.folder_id as string | null, planId);
  return { success: true };
}

export async function updateDayMenuDetails(
  planId: string,
  data: { title: string; description?: string | null }
) {
  const { supabase, userId } = await requireUserId();

  const { data: plan, error } = await supabase
    .from("nutrition_plans")
    .update({
      title: data.title.trim(),
      description: data.description?.trim() || null,
    })
    .eq("id", planId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidateNutritionPaths(plan?.folder_id, planId);
  return { data: plan };
}

export async function createPersonalMeal(targetPlanId: string, data: MealFormData) {
  const trimmed = data.name.trim();
  if (!trimmed) return { error: "Meal name is required" };

  const { supabase, userId } = await requireMutationUserId();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, folder_id")
    .eq("id", targetPlanId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!plan) return { error: "Meal plan not found" };

  const { data: last } = await supabase
    .from("meals")
    .select("order_index")
    .eq("plan_id", targetPlanId)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { error } = await supabase.from("meals").insert({
    plan_id: targetPlanId,
    ...mealPayloadFromForm(data),
    order_index: orderIndex,
  });

  if (error) return { error: error.message };
  revalidateNutritionPaths(plan.folder_id as string | null, targetPlanId);
  return { success: true };
}

export async function createPersonalMealInNewPlanInFolder(
  folderId: string,
  data: MealFormData,
  planTitle?: string
) {
  const title = planTitle?.trim() || `${data.name.trim()} plan`;
  const result = await createPersonalNutritionPlan(title, undefined, undefined, folderId);

  if (result.error || !result.data) {
    return { error: result.error ?? "Failed to create plan" };
  }

  const mealResult = await createPersonalMeal(result.data.id, data);
  if ("error" in mealResult && mealResult.error) return mealResult;

  return { success: true, planId: result.data.id };
}

export async function copyMealToPlan(mealId: string, targetPlanId: string) {
  const found = await getPersonalMealWithPlan(mealId);
  if (!found) return { error: "Meal not found" };

  const { supabase, userId } = await requireUserId();
  const { data: target } = await supabase
    .from("nutrition_plans")
    .select("id, folder_id")
    .eq("id", targetPlanId)
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (!target) return { error: "Meal plan not found" };

  const { data: last } = await supabase
    .from("meals")
    .select("order_index")
    .eq("plan_id", targetPlanId)
    .order("order_index", { ascending: false })
    .limit(1);

  const orderIndex = (last?.[0]?.order_index ?? -1) + 1;

  const { error } = await supabase.from("meals").insert({
    plan_id: targetPlanId,
    ...mealPayloadFromForm({
      meal_type: found.meal.meal_type,
      name: found.meal.name,
      description: found.meal.description ?? "",
      macros: normalizeMealMacros(found.meal),
      ingredients: (found.meal.foods ?? []).map((f) => ({
        name: f.name,
        amount: f.amount ?? "",
      })),
    }),
    order_index: orderIndex,
  });

  if (error) return { error: error.message };
  revalidateNutritionPaths(target.folder_id as string | null, targetPlanId);
  return { success: true };
}

export async function copyMealToNewPlanInFolder(
  mealId: string,
  folderId: string,
  planTitle?: string
) {
  const found = await getPersonalMealWithPlan(mealId);
  if (!found) return { error: "Meal not found" };

  const title = planTitle?.trim() || `${found.meal.name} plan`;
  const result = await createPersonalNutritionPlan(
    title,
    undefined,
    {
      target_calories: found.plan.target_calories,
      target_protein: found.plan.target_protein,
      target_carbs: found.plan.target_carbs,
      target_fat: found.plan.target_fat,
    },
    folderId
  );

  if (result.error || !result.data) {
    return { error: result.error ?? "Failed to create plan" };
  }

  const copyResult = await copyMealToPlan(mealId, result.data.id);
  if (copyResult.error) return copyResult;

  return { success: true, planId: result.data.id };
}
