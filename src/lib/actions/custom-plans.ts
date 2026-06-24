"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomPlanProduct, TRAINER_NAME } from "@/lib/custom-plan-products";
import { createSdkOrder, getSdkOrder, isSdkOrderPaid } from "@/lib/pokpay/client";
import type { Meal, PlanRequest, PlanRequestType, NutritionScheduleConfig } from "@/lib/types";
import { scheduleNutritionForClient, clearAllClientNutritionSchedule } from "@/lib/actions/admin-nutrition";

async function activateWorkoutAssignment(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  planId: string
): Promise<{ error?: string }> {
  await admin
    .from("workout_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error } = await admin.from("workout_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };
  return {};
}

async function activateNutritionAssignment(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  planId: string
): Promise<{ error?: string }> {
  await admin
    .from("nutrition_assignments")
    .update({ active: false })
    .eq("client_id", clientId);

  const { error } = await admin.from("nutrition_assignments").insert({
    client_id: clientId,
    plan_id: planId,
    active: true,
  });

  if (error) return { error: error.message };
  return {};
}

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function createCustomPlanCheckout(
  type: PlanRequestType,
  preferences: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const product = getCustomPlanProduct(type);
  if (!product) return { error: "Invalid plan type" };

  const trimmed = preferences.trim();
  if (trimmed.length < 10) {
    return { error: "Tell us about your goals and preferences (at least 10 characters)" };
  }

  const { data: existing } = await supabase
    .from("plan_requests")
    .select("id")
    .eq("client_id", user.id)
    .eq("type", type)
    .in("status", ["awaiting_approval", "in_progress", "delivered", "pending"])
    .maybeSingle();

  if (existing) {
    return { error: "You already have an active request for this plan type" };
  }

  const baseUrl = appBaseUrl();
  const { data: orderRow, error: insertError } = await supabase
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      plan: "core",
      billing_interval: "monthly",
      amount_cents: product.amountCents,
      currency_code: "EUR",
      status: "pending",
      order_kind: product.orderKind,
      metadata: { preferences: trimmed, plan_type: type },
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  try {
    const redirectUrl = `${baseUrl}/dashboard/checkout/custom-success?localOrderId=${orderRow.id}&type=${type}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const sdkOrder = await createSdkOrder({
      amountCents: product.amountCents,
      redirectUrl,
      webhookUrl,
    });

    await supabase
      .from("subscription_orders")
      .update({ pokpay_order_id: sdkOrder.id })
      .eq("id", orderRow.id);

    return {
      localOrderId: orderRow.id,
      orderId: sdkOrder.id,
      productTitle: product.title,
      priceLabel: product.label,
    };
  } catch (err) {
    await supabase
      .from("subscription_orders")
      .update({ status: "failed" })
      .eq("id", orderRow.id);
    return {
      error: err instanceof Error ? err.message : "Payment provider unavailable",
    };
  }
}

export async function activateCustomPlanFromOrder(localOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("*")
    .eq("id", localOrderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { error: "Order not found" };

  return completeCustomPlanOrder(order);
}

async function completeCustomPlanOrder(order: {
  id: string;
  user_id: string;
  order_kind: string;
  status: string;
  pokpay_order_id: string | null;
  amount_cents: number | null;
  metadata: Record<string, unknown> | null;
}) {
  if (order.order_kind === "subscription") {
    return { error: "Not a custom plan order" };
  }
  if (order.status === "completed") {
    return { success: true, alreadyCompleted: true };
  }
  if (!order.pokpay_order_id) return { error: "Payment not started" };

  const admin = createAdminClient();

  try {
    const sdkOrder = await getSdkOrder(order.pokpay_order_id);
    if (!isSdkOrderPaid(sdkOrder)) {
      return { error: "Payment not completed yet" };
    }

    const metadata = (order.metadata ?? {}) as {
      preferences?: string;
      plan_type?: PlanRequestType;
      plan_request_id?: string;
    };

    if (metadata.plan_request_id) {
      await admin
        .from("subscription_orders")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", order.id);
      return { success: true };
    }

    const planType =
      metadata.plan_type ?? (order.order_kind === "custom_workout" ? "workout" : "diet");
    const preferences = metadata.preferences ?? "";

    const { data: request, error: requestError } = await admin
      .from("plan_requests")
      .insert({
        client_id: order.user_id,
        type: planType,
        status: "awaiting_approval",
        notes: preferences,
        preferences,
        payment_order_id: order.id,
        amount_cents: order.amount_cents,
      })
      .select("id")
      .single();

    if (requestError || !request) {
      return { error: requestError?.message ?? "Could not create plan request" };
    }

    await admin
      .from("subscription_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: { ...metadata, plan_request_id: request.id },
      })
      .eq("id", order.id);

    await admin.rpc("notify_all_admins", {
      p_type: "custom_plan_request",
      p_title: `New paid ${planType} plan request`,
      p_body: `${TRAINER_NAME}: review and approve the client's proposal.`,
      p_metadata: { request_id: request.id, client_id: order.user_id, type: planType },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workout");
    revalidatePath("/dashboard/nutrition");
    revalidatePath("/admin");

    return { success: true, requestId: request.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify payment",
    };
  }
}

export async function activateCustomPlanFromPokPayOrder(pokpayOrderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("*")
    .eq("pokpay_order_id", pokpayOrderId)
    .single();

  if (!order) return { error: "Order not found" };
  return completeCustomPlanOrder(order);
}

export async function approvePlanRequest(requestId: string) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "awaiting_approval") {
    return { error: "Request not found or not awaiting approval" };
  }

  await admin
    .from("plan_requests")
    .update({
      status: "in_progress",
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  await admin.rpc("notify_user", {
    p_user_id: request.client_id,
    p_type: "plan_approved",
    p_title: "Your plan proposal was accepted",
    p_body: `${TRAINER_NAME} is now building your custom ${request.type} plan.`,
    p_metadata: { request_id: requestId },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export async function rejectPlanRequest(requestId: string, reason?: string) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "awaiting_approval") {
    return { error: "Request not found or not awaiting approval" };
  }

  await admin
    .from("plan_requests")
    .update({
      status: "rejected",
      rejected_reason: reason?.trim() || "Not accepted by trainer",
    })
    .eq("id", requestId);

  if (request.payment_order_id) {
    await admin
      .from("subscription_orders")
      .update({
        status: "failed",
        metadata: { refunded: true, reason: reason ?? null },
      })
      .eq("id", request.payment_order_id);
  }

  await admin.rpc("notify_user", {
    p_user_id: request.client_id,
    p_type: "plan_rejected",
    p_title: "Plan proposal not accepted",
    p_body: "Your payment will be refunded.",
    p_metadata: { request_id: requestId },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export async function findDeliverablePlanRequest(
  clientId: string,
  type: PlanRequestType
): Promise<PlanRequest | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("plan_requests")
    .select("*")
    .eq("client_id", clientId)
    .eq("type", type)
    .in("status", ["pending", "awaiting_approval", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PlanRequest | null) ?? null;
}

const DELIVERABLE_STATUSES = ["pending", "awaiting_approval", "in_progress"] as const;

export async function sendTrainerPlanToClient(
  requestId: string,
  planId: string,
  type: "workout" | "nutrition",
  scheduleConfig?: NutritionScheduleConfig | null
) {
  const admin = createAdminClient();

  const { data: request, error: fetchError } = await admin
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: fetchError?.message ?? "Plan request not found" };
  }

  if (!DELIVERABLE_STATUSES.includes(request.status as (typeof DELIVERABLE_STATUSES)[number])) {
    return {
      error: `Cannot send plan while request is "${request.status.replace(/_/g, " ")}".`,
    };
  }

  const planTable = type === "workout" ? "workout_plans" : "nutrition_plans";
  const { error: planError } = await admin
    .from(planTable)
    .update({ trainer_label: TRAINER_NAME })
    .eq("id", planId);

  if (planError) {
    return { error: planError.message };
  }

  const updates: Record<string, unknown> = {
    status: "delivered",
    delivered_at: new Date().toISOString(),
  };
  if (type === "workout") {
    updates.delivered_workout_plan_id = planId;
  } else {
    updates.delivered_nutrition_plan_id = planId;
    if (scheduleConfig) {
      updates.schedule_config = scheduleConfig;
    }
  }

  let { error: updateError } = await admin
    .from("plan_requests")
    .update(updates)
    .eq("id", requestId);

  if (updateError && scheduleConfig && type === "nutrition") {
    const { schedule_config: _removed, ...withoutSchedule } = updates;
    ({ error: updateError } = await admin
      .from("plan_requests")
      .update(withoutSchedule)
      .eq("id", requestId));
  }

  if (updateError) {
    if (updateError.message.includes("plan_requests_status_check")) {
      return {
        error:
          "Database needs migration 20240710_custom_trainer_plans.sql — run it in Supabase SQL Editor, then try again.",
      };
    }
    return { error: updateError.message };
  }

  try {
    await admin.rpc("notify_user", {
      p_user_id: request.client_id,
      p_type: "plan_delivered",
      p_title: `Your ${request.type} plan is ready`,
      p_body: `${TRAINER_NAME} sent your custom plan. Add it to your calendar when you're ready.`,
      p_metadata: { request_id: requestId, plan_id: planId },
    });
  } catch {
    // Delivery succeeded; notification is best-effort.
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${request.client_id}`);
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export async function implementTrainerPlan(requestId: string): Promise<
  | { error: string }
  | { success: true; type: PlanRequestType; planTitle: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: request } = await supabase
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .eq("client_id", user.id)
    .single();

  if (!request || request.status !== "delivered") {
    return { error: "Plan not ready to implement" };
  }

  const admin = createAdminClient();
  let planTitle = "Your plan";

  if (request.type === "workout" && request.delivered_workout_plan_id) {
    const assignmentResult = await activateWorkoutAssignment(
      admin,
      user.id,
      request.delivered_workout_plan_id
    );
    if (assignmentResult.error) return { error: assignmentResult.error };

    const { data: plan } = await admin
      .from("workout_plans")
      .select("title")
      .eq("id", request.delivered_workout_plan_id)
      .single();
    planTitle = plan?.title ?? "Workout plan";
  } else if (request.type === "diet" && request.delivered_nutrition_plan_id) {
    const { data: plan } = await admin
      .from("nutrition_plans")
      .select("title, target_calories, target_protein, target_carbs, target_fat")
      .eq("id", request.delivered_nutrition_plan_id)
      .single();

    if (!plan) return { error: "Delivered plan not found" };
    planTitle = plan.title;

    const assignmentResult = await activateNutritionAssignment(
      admin,
      user.id,
      request.delivered_nutrition_plan_id
    );
    if (assignmentResult.error) return { error: assignmentResult.error };

    await supabase
      .from("profiles")
      .update({
        target_calories: plan.target_calories,
        target_protein: plan.target_protein,
        target_carbs: plan.target_carbs,
        target_fat: plan.target_fat,
      })
      .eq("id", user.id);

    const scheduleConfig = request.schedule_config as NutritionScheduleConfig | null;
    if (scheduleConfig) {
      await clearAllClientNutritionSchedule(user.id);

      const { data: meals } = await admin
        .from("meals")
        .select("*")
        .eq("plan_id", request.delivered_nutrition_plan_id)
        .order("order_index");

      const scheduleResult = await scheduleNutritionForClient(
        user.id,
        request.delivered_nutrition_plan_id,
        scheduleConfig,
        (meals ?? []) as Meal[]
      );
      if ("error" in scheduleResult && scheduleResult.error) {
        return { error: scheduleResult.error };
      }
    }
  } else {
    return { error: "Delivered plan not found" };
  }

  const { error: statusError } = await admin
    .from("plan_requests")
    .update({
      status: "implemented",
      implemented_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("client_id", user.id);

  if (statusError) return { error: statusError.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/nutrition");
  return {
    success: true,
    type: request.type as PlanRequestType,
    planTitle,
  };
}

export async function removeTrainerPlanImplementation(
  requestId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: request } = await supabase
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .eq("client_id", user.id)
    .single();

  if (!request || request.status !== "implemented") {
    return { error: "Plan is not on your calendar" };
  }

  const admin = createAdminClient();

  if (request.type === "workout" && request.delivered_workout_plan_id) {
    await admin
      .from("workout_assignments")
      .update({ active: false })
      .eq("client_id", user.id)
      .eq("plan_id", request.delivered_workout_plan_id);

    await admin
      .from("scheduled_workouts")
      .delete()
      .eq("client_id", user.id)
      .eq("plan_id", request.delivered_workout_plan_id);
  } else if (request.type === "diet" && request.delivered_nutrition_plan_id) {
    await admin
      .from("nutrition_assignments")
      .update({ active: false })
      .eq("client_id", user.id)
      .eq("plan_id", request.delivered_nutrition_plan_id);

    await admin
      .from("scheduled_meal_slots")
      .delete()
      .eq("client_id", user.id)
      .eq("plan_id", request.delivered_nutrition_plan_id);

    await admin
      .from("scheduled_nutrition_days")
      .delete()
      .eq("client_id", user.id)
      .eq("plan_id", request.delivered_nutrition_plan_id);
  } else {
    return { error: "Delivered plan not found" };
  }

  const { error: statusError } = await admin
    .from("plan_requests")
    .update({
      status: "delivered",
      implemented_at: null,
    })
    .eq("id", requestId)
    .eq("client_id", user.id);

  if (statusError) return { error: statusError.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export async function getClientPlanRequests(clientId: string): Promise<PlanRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlanRequest[];
}
