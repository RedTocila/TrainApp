"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/server-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseCheckoutCurrency,
  type CheckoutCurrency,
} from "@/lib/checkout-i18n";
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
  type PokPaySdkOrderProduct,
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

  return getCachedProfile(user.id);
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
  interval: BillingInterval,
  currencyCode: CheckoutCurrency = "ALL"
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const plan = getPlan(planId);
  if (!plan) return { error: "Invalid plan" };

  const currency = parseCheckoutCurrency(currencyCode);
  const price = getPlanPrice(planId, interval, currency);
  const baseUrl = getAppBaseUrl();
  const isProd = process.env.VERCEL_ENV === "production";
  if (isProd && baseUrl.includes("localhost")) {
    return {
      error:
        "Checkout is not configured for production. Set APP_URL to your live domain in Vercel Environment Variables.",
    };
  }

  const { data: orderRow, error: insertError } = await admin
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      plan: planId,
      billing_interval: interval,
      amount_cents: price.amountCents,
      currency_code: currency,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  try {
    const redirectUrl = `${baseUrl}/dashboard/checkout/success?localOrderId=${orderRow.id}`;
    const failRedirectUrl = `${baseUrl}/dashboard/checkout?plan=${planId}&interval=${interval}&currency=${currency}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const products: PokPaySdkOrderProduct[] = [
      {
        name: `${plan.name} · ${interval === "monthly" ? "Monthly" : "Annual"}`,
        quantity: 1,
        // Keep product price consistent with order amount (minor units, cents)
        price: price.amountCents,
      },
    ];
    const sdkOrder = await createSdkOrder({
      amountCents: price.amountCents,
      currencyCode: currency,
      redirectUrl,
      failRedirectUrl,
      webhookUrl,
      description: `${plan.name} subscription`,
      merchantCustomReference: orderRow.id,
      products,
    });

    await admin
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
    await admin
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
    .select("id, user_id, plan, billing_interval, status, pokpay_order_id, amount_cents, created_at")
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
    .select("id, user_id, plan, billing_interval, status, pokpay_order_id, order_kind, amount_cents, created_at")
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
