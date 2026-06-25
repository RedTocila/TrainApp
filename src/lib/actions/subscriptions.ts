"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlan,
  getPlanPrice,
  type BillingInterval,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { addBillingPeriod, hasPaidAccess } from "@/lib/subscription";
import {
  createSdkOrder,
  getSdkOrder,
  isSdkOrderPaid,
} from "@/lib/pokpay/client";
import { getAppBaseUrl } from "@/lib/app-url";
import type { Profile } from "@/lib/types";
import { SUBSCRIPTION_REQUIRED_MESSAGE } from "@/lib/subscription-messages";

export async function getSubscriptionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile as Profile | null;
}

export async function ensureSubscribedMutation(): Promise<
  { profile: Profile } | { error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (hasPaidAccess(profile)) return { profile };
  return { error: SUBSCRIPTION_REQUIRED_MESSAGE };
}

export async function createCheckoutOrder(
  planId: SubscriptionPlanId,
  interval: BillingInterval
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const plan = getPlan(planId);
  if (!plan) return { error: "Invalid plan" };

  const price = getPlanPrice(planId, interval);
  const baseUrl = getAppBaseUrl();

  const { data: orderRow, error: insertError } = await supabase
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      plan: planId,
      billing_interval: interval,
      amount_cents: price.amountCents,
      currency_code: "EUR",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  try {
    const redirectUrl = `${baseUrl}/dashboard/checkout/success?localOrderId=${orderRow.id}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const sdkOrder = await createSdkOrder({
      amountCents: price.amountCents,
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
      amountCents: price.amountCents,
      planId,
      interval,
      planName: plan.name,
      priceLabel: price.label,
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

export async function activateSubscriptionFromLocalOrder(localOrderId: string) {
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
  if (order.status === "completed") {
    return { success: true, alreadyCompleted: true };
  }
  if (!order.pokpay_order_id) return { error: "Payment not started" };

  try {
    const sdkOrder = await getSdkOrder(order.pokpay_order_id);
    if (!isSdkOrderPaid(sdkOrder)) {
      return { error: "Payment not completed yet" };
    }

    const now = new Date();
    const expiresAt = addBillingPeriod(
      now,
      order.billing_interval as BillingInterval
    );

    await admin
      .from("profiles")
      .update({
        subscription_plan: order.plan,
        subscription_status: "active",
        subscription_interval: order.billing_interval,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("id", user.id);

    await admin
      .from("subscription_orders")
      .update({
        status: "completed",
        completed_at: now.toISOString(),
      })
      .eq("id", order.id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pricing");
    revalidatePath("/dashboard/checkout");

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify payment",
    };
  }
}

export async function activateSubscriptionFromPokPayOrder(pokpayOrderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("*")
    .eq("pokpay_order_id", pokpayOrderId)
    .single();

  if (!order || order.status === "completed") return;

  const sdkOrder = await getSdkOrder(pokpayOrderId);
  if (!isSdkOrderPaid(sdkOrder)) return;

  const orderKind = (order.order_kind as string) ?? "subscription";

  if (orderKind === "custom_workout" || orderKind === "custom_nutrition") {
    const { activateCustomPlanFromPokPayOrder } = await import(
      "@/lib/actions/custom-plans"
    );
    await activateCustomPlanFromPokPayOrder(pokpayOrderId);
    return;
  }

  const now = new Date();
  const expiresAt = addBillingPeriod(
    now,
    order.billing_interval as BillingInterval
  );

  await admin
    .from("profiles")
    .update({
      subscription_plan: order.plan,
      subscription_status: "active",
      subscription_interval: order.billing_interval,
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", order.user_id);

  await admin
    .from("subscription_orders")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
    })
    .eq("id", order.id);
}
