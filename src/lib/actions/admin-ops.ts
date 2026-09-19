"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/auth";
import { deleteClientAccount } from "@/lib/actions/admin-clients";
import {
  getAdminClientsWithSubscriptions,
  getAdminDashboardStats,
  getAdminRevenue,
  type AdminClientRow,
  type RevenuePeriod,
} from "@/lib/actions/admin-stats";
import { sendAdminMail } from "@/lib/actions/admin-mail";
import { getAdminSubscriptionOffers } from "@/lib/actions/admin-offers";
import { createAdminClient } from "@/lib/supabase/admin";
import { addBillingPeriod, subscriptionLabel } from "@/lib/subscription";
import {
  isSoldPlanId,
  type BillingInterval,
  type SoldSubscriptionPlanId,
} from "@/lib/subscription-plans";
import { generateWorkoutPlanFromProfile } from "@/lib/ai/generate-workout-plan";
import { generateNutritionPlanFromProfile } from "@/lib/ai/generate-nutrition-plan";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import type { AiGeneratedNutritionPlan, AiGeneratedWorkoutPlan } from "@/lib/ai/plan-builder-types";
import { enrichExerciseWithGif } from "@/lib/exercise-gif";
import { normalizeHiitConfig } from "@/lib/hiit";
import type { Profile } from "@/lib/types";
import type { MailAudience } from "@/lib/mail-presets";

function summarizeClient(c: AdminClientRow) {
  return {
    id: c.id,
    full_name: c.full_name,
    email: c.email ?? null,
    subscription: c.subscriptionLabel,
    active_subscription: c.activeSubscription,
    on_free_trial: c.onFreeTrial,
    trial_days_left: c.trialDaysLeft,
    expires_at: c.subscriptionExpiresAt,
    plan: c.subscription_plan ?? null,
    status: c.subscription_status ?? null,
    created_at: c.created_at,
  };
}

async function loadClientProfile(clientId: string): Promise<Profile> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .eq("role", "client")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found.");
  return data as Profile;
}

async function findAuthEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

/** Resolve a client by UUID, email, or fuzzy full name. */
export async function adminResolveClient(query: string): Promise<{
  matches: ReturnType<typeof summarizeClient>[];
  exact?: ReturnType<typeof summarizeClient>;
}> {
  await requireAdmin();
  const q = query.trim();
  if (!q) return { matches: [] };

  const clients = await getAdminClientsWithSubscriptions();
  const lower = q.toLowerCase();

  const byId = clients.find((c) => c.id === q);
  if (byId) {
    const row = summarizeClient(byId);
    return { matches: [row], exact: row };
  }

  const byEmail = clients.filter((c) => c.email?.toLowerCase() === lower);
  if (byEmail.length === 1) {
    const row = summarizeClient(byEmail[0]);
    return { matches: [row], exact: row };
  }

  const fuzzy = clients
    .filter((c) => {
      const name = c.full_name?.toLowerCase() ?? "";
      const email = c.email?.toLowerCase() ?? "";
      return name.includes(lower) || email.includes(lower);
    })
    .slice(0, 12)
    .map(summarizeClient);

  if (fuzzy.length === 1) {
    return { matches: fuzzy, exact: fuzzy[0] };
  }
  return { matches: fuzzy };
}

export async function adminListClients(options?: {
  filter?: "all" | "subscribed" | "trialing" | "not_subscribed";
  limit?: number;
}) {
  await requireAdmin();
  const filter = options?.filter ?? "all";
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const clients = await getAdminClientsWithSubscriptions();
  const filtered = clients.filter((c) => {
    if (filter === "subscribed") return c.activeSubscription && !c.onFreeTrial;
    if (filter === "trialing") return c.onFreeTrial;
    if (filter === "not_subscribed") return !c.activeSubscription;
    return true;
  });
  return {
    total: filtered.length,
    clients: filtered.slice(0, limit).map(summarizeClient),
  };
}

export async function adminGetClientDetail(clientId: string) {
  await requireAdmin();
  const clients = await getAdminClientsWithSubscriptions();
  const client = clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Client not found.");

  const admin = createAdminClient();
  const [workout, nutrition] = await Promise.all([
    admin
      .from("workout_assignments")
      .select("id, plan_id, active, workout_plans(id, title, description, kind)")
      .eq("client_id", clientId)
      .eq("active", true)
      .maybeSingle(),
    admin
      .from("nutrition_assignments")
      .select(
        "id, plan_id, active, nutrition_plans(id, title, description, target_calories, target_protein, target_carbs, target_fat)"
      )
      .eq("client_id", clientId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  return {
    ...summarizeClient(client),
    phone: client.phone ?? null,
    gender: client.gender ?? null,
    goal: client.goal ?? null,
    active_workout: workout.data
      ? {
          assignment_id: workout.data.id,
          plan: workout.data.workout_plans,
        }
      : null,
    active_nutrition: nutrition.data
      ? {
          assignment_id: nutrition.data.id,
          plan: nutrition.data.nutrition_plans,
        }
      : null,
  };
}

export async function adminGrantSubscription(input: {
  clientId: string;
  plan: SoldSubscriptionPlanId;
  interval: BillingInterval;
  /** Extra days beyond one billing period. Ignored when extendFromNow is false and they already have time left. */
  extendFromNow?: boolean;
  confirm?: boolean;
}) {
  await requireAdmin();
  if (!isSoldPlanId(input.plan)) {
    throw new Error("Plan must be 'ai' (AI Pro) or 'elite'.");
  }
  if (input.interval !== "monthly" && input.interval !== "annual") {
    throw new Error("Interval must be monthly or annual.");
  }

  const profile = await loadClientProfile(input.clientId);
  const email = await findAuthEmail(input.clientId);
  const now = new Date();
  const base =
    input.extendFromNow === false &&
    profile.subscription_expires_at &&
    new Date(profile.subscription_expires_at) > now
      ? new Date(profile.subscription_expires_at)
      : now;
  const expiresAt = addBillingPeriod(base, input.interval);
  const preview = {
    client_id: input.clientId,
    full_name: profile.full_name,
    email,
    plan: input.plan,
    interval: input.interval,
    expires_at: expiresAt.toISOString(),
    label: subscriptionLabel(input.plan, input.interval),
  };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_plan: input.plan,
      subscription_status: "active",
      subscription_interval: input.interval,
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", input.clientId)
    .eq("role", "client");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/admin");
  return { status: "ok" as const, ...preview };
}

export async function adminRevokeSubscription(input: {
  clientId: string;
  confirm?: boolean;
}) {
  await requireAdmin();
  const profile = await loadClientProfile(input.clientId);
  const email = await findAuthEmail(input.clientId);
  const preview = {
    client_id: input.clientId,
    full_name: profile.full_name,
    email,
    previous_plan: profile.subscription_plan ?? null,
    previous_status: profile.subscription_status ?? null,
    previous_expires_at: profile.subscription_expires_at ?? null,
  };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_plan: null,
      subscription_interval: null,
      subscription_expires_at: null,
    })
    .eq("id", input.clientId)
    .eq("role", "client");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/admin");
  return { status: "ok" as const, ...preview };
}

export async function adminCreateClientAccount(input: {
  email: string;
  fullName: string;
  password?: string;
  plan?: SoldSubscriptionPlanId | null;
  interval?: BillingInterval;
  confirm?: boolean;
}) {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !email.includes("@")) throw new Error("Valid email is required.");
  if (!fullName) throw new Error("Full name is required.");

  const password =
    input.password?.trim() || randomBytes(12).toString("base64url").slice(0, 16);
  const preview = {
    email,
    full_name: fullName,
    plan: input.plan ?? null,
    interval: input.interval ?? "monthly",
    password_will_be_set: true,
  };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Could not create account.");
  }

  const userId = created.user.id;
  const referralCode = randomBytes(5).toString("hex").slice(0, 8);

  // Wait briefly for any auth trigger that creates profiles.
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) break;
    await new Promise((r) => setTimeout(r, 75 * (attempt + 1)));
  }

  await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role: "client",
      referral_code: referralCode,
      subscription_status: "inactive",
    },
    { onConflict: "id" }
  );

  let subscription: Awaited<ReturnType<typeof adminGrantSubscription>> | null = null;
  if (input.plan && isSoldPlanId(input.plan)) {
    subscription = await adminGrantSubscription({
      clientId: userId,
      plan: input.plan,
      interval: input.interval ?? "monthly",
      confirm: true,
    });
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin");

  return {
    status: "ok" as const,
    client_id: userId,
    email,
    full_name: fullName,
    temporary_password: password,
    subscription,
  };
}

export async function adminDeleteClient(input: {
  clientId: string;
  confirm?: boolean;
}) {
  await requireAdmin();
  const profile = await loadClientProfile(input.clientId);
  const email = await findAuthEmail(input.clientId);
  const preview = {
    client_id: input.clientId,
    full_name: profile.full_name,
    email,
    warning: "This permanently deletes the auth user and cascaded data.",
  };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  await deleteClientAccount(input.clientId);
  return { status: "ok" as const, deleted: preview };
}

async function applyStrengthWorkoutToClient(
  clientId: string,
  plan: AiGeneratedWorkoutPlan
): Promise<{ planId: string; title: string }> {
  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("workout_plans")
    .insert({
      title: plan.title,
      description: plan.description || `Admin AI · ${plan.days_per_week} days/week`,
      created_by: clientId,
      is_personal: true,
      kind: "strength",
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not create workout plan.");
  const planId = created.id as string;

  for (let i = 0; i < plan.days.length; i++) {
    const day = plan.days[i];
    const { data: dayRow, error: dayError } = await admin
      .from("workout_days")
      .insert({ plan_id: planId, day_index: i, title: day.title })
      .select("id")
      .single();
    if (dayError || !dayRow) throw new Error(dayError?.message ?? "Could not create workout day.");

    if (day.exercises.length > 0) {
      const enriched = day.exercises.map((ex) =>
        enrichExerciseWithGif({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          image_url: ex.image_url,
          video_url: ex.video_url,
        })
      );
      const { error: exError } = await admin.from("exercises").insert(
        enriched.map((ex, orderIndex) => ({
          day_id: dayRow.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes ?? null,
          image_url: ex.image_url ?? null,
          video_url: ex.video_url ?? null,
          order_index: orderIndex,
        }))
      );
      if (exError) throw new Error(exError.message);
    }
  }

  await admin
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error: assignError } = await admin.from("workout_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });
  if (assignError) throw new Error(assignError.message);

  return { planId, title: plan.title };
}

async function applyHiitWorkoutToClient(
  clientId: string,
  title: string,
  description: string,
  config: NonNullable<ReturnType<typeof normalizeHiitConfig>>
): Promise<{ planId: string; title: string }> {
  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("workout_plans")
    .insert({
      title,
      description: description || "Admin AI · HIIT",
      created_by: clientId,
      is_personal: true,
      kind: "hiit",
      hiit_config: config,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not create HIIT plan.");
  const planId = created.id as string;

  const { data: dayRow, error: dayError } = await admin
    .from("workout_days")
    .insert({ plan_id: planId, day_index: 0, title: "HIIT" })
    .select("id")
    .single();
  if (dayError || !dayRow) throw new Error(dayError?.message ?? "Could not create HIIT day.");

  if (config.exercises.length > 0) {
    const { error: exError } = await admin.from("exercises").insert(
      config.exercises.map((ex, i) => ({
        day_id: dayRow.id,
        name: ex.name,
        sets: 1,
        reps: `${ex.work_seconds}s`,
        rest_seconds: ex.rest_seconds,
        notes: null,
        image_url: ex.image_url ?? null,
        video_url: ex.video_url ?? null,
        order_index: i,
      }))
    );
    if (exError) throw new Error(exError.message);
  }

  await admin
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error: assignError } = await admin.from("workout_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });
  if (assignError) throw new Error(assignError.message);

  return { planId, title };
}

export async function adminBuildWorkoutForClient(input: {
  clientId: string;
  preferences?: string;
  workoutKind?: "strength" | "hiit" | null;
  confirm?: boolean;
}) {
  await requireAdmin();
  const profile = await loadClientProfile(input.clientId);
  const email = await findAuthEmail(input.clientId);

  const generated = await generateWorkoutPlanFromProfile(
    profile,
    input.preferences,
    input.workoutKind ?? null
  );

  const preview = isAiHiitPlan(generated)
    ? {
        client_id: input.clientId,
        full_name: profile.full_name,
        email,
        kind: "hiit" as const,
        title: generated.title,
        exercises: generated.config.exercises.length,
        rounds: generated.config.rounds,
      }
    : {
        client_id: input.clientId,
        full_name: profile.full_name,
        email,
        kind: "strength" as const,
        title: generated.title,
        days: generated.days.length,
        days_per_week: generated.days_per_week,
      };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  const applied = isAiHiitPlan(generated)
    ? await (async () => {
        const config = normalizeHiitConfig(generated.config);
        if (!config) throw new Error("Invalid HIIT config from generator.");
        return applyHiitWorkoutToClient(
          input.clientId,
          generated.title,
          generated.description,
          config
        );
      })()
    : await applyStrengthWorkoutToClient(input.clientId, generated);

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { status: "ok" as const, ...preview, plan_id: applied.planId };
}

async function applyNutritionToClient(
  clientId: string,
  plan: AiGeneratedNutritionPlan
): Promise<{ planId: string; title: string }> {
  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("nutrition_plans")
    .insert({
      title: plan.title,
      description: plan.description || "Admin AI day menu",
      created_by: clientId,
      is_personal: true,
      target_calories: plan.daily_targets.calories,
      target_protein: plan.daily_targets.protein,
      target_carbs: plan.daily_targets.carbs,
      target_fat: plan.daily_targets.fat,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not create nutrition plan.");
  const planId = created.id as string;

  for (let i = 0; i < plan.meals.length; i++) {
    const meal = plan.meals[i];
    const slot = meal.slot ?? "snack";
    const mealType =
      slot === "breakfast" || slot === "lunch" || slot === "dinner" ? slot : "snack";
    const { error: mealError } = await admin.from("meals").insert({
      plan_id: planId,
      meal_type: mealType,
      slot,
      name: meal.name,
      description: meal.description ?? null,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      foods: (meal.ingredients ?? []).map((ing) => ({
        name: typeof ing === "string" ? ing : ing.name,
        amount: typeof ing === "string" ? "" : (ing.amount ?? ""),
      })),
      order_index: i,
    });
    if (mealError) throw new Error(mealError.message);
  }

  if (plan.grocery_list?.length) {
    await admin
      .from("nutrition_plans")
      .update({
        grocery_list: plan.grocery_list.map((item) =>
          typeof item === "string" ? { name: item } : item
        ),
      })
      .eq("id", planId);
  }

  await admin
    .from("nutrition_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error: assignError } = await admin.from("nutrition_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });
  if (assignError) throw new Error(assignError.message);

  await admin
    .from("profiles")
    .update({
      target_calories: plan.daily_targets.calories,
      target_protein: plan.daily_targets.protein,
      target_carbs: plan.daily_targets.carbs,
      target_fat: plan.daily_targets.fat,
    })
    .eq("id", clientId);

  return { planId, title: plan.title };
}

export async function adminBuildNutritionForClient(input: {
  clientId: string;
  preferences?: string;
  confirm?: boolean;
}) {
  await requireAdmin();
  const profile = await loadClientProfile(input.clientId);
  const email = await findAuthEmail(input.clientId);

  const generated = await generateNutritionPlanFromProfile(profile, input.preferences);
  const preview = {
    client_id: input.clientId,
    full_name: profile.full_name,
    email,
    title: generated.title,
    calories: generated.daily_targets.calories,
    protein: generated.daily_targets.protein,
    carbs: generated.daily_targets.carbs,
    fat: generated.daily_targets.fat,
    meals: generated.meals.length,
  };

  if (input.confirm !== true) {
    return { status: "needs_confirmation" as const, preview };
  }

  const applied = await applyNutritionToClient(input.clientId, generated);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { status: "ok" as const, ...preview, plan_id: applied.planId };
}

export async function adminGetPlatformStats() {
  await requireAdmin();
  const [stats, revenue30d, revenueAll] = await Promise.all([
    getAdminDashboardStats(),
    getAdminRevenue("30d"),
    getAdminRevenue("all"),
  ]);
  return { stats, revenue30d, revenueAll };
}

export async function adminGetRevenue(period: RevenuePeriod = "30d") {
  await requireAdmin();
  return getAdminRevenue(period);
}

export async function adminListOffers() {
  await requireAdmin();
  return getAdminSubscriptionOffers();
}

export async function adminSendMail(input: {
  audience: MailAudience;
  clientId?: string | null;
  subject: string;
  body: string;
  dryRun?: boolean;
  confirm?: boolean;
}) {
  await requireAdmin();
  const dryRun = input.dryRun === true || input.confirm !== true;
  const result = await sendAdminMail({
    audience: input.audience,
    clientId: input.clientId,
    presetId: "custom",
    subject: input.subject,
    body: input.body,
    dryRun,
  });

  if (dryRun && input.confirm !== true) {
    return {
      status: "needs_confirmation" as const,
      preview: result,
      message:
        "Dry run complete. Call again with confirm=true (and dryRun=false) to send for real.",
    };
  }

  return { status: result.ok ? ("ok" as const) : ("error" as const), ...result };
}
