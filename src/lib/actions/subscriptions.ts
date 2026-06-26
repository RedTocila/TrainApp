"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHECKOUT_CURRENCY,
  parseCheckoutLocale,
} from "@/lib/checkout-i18n";
import {
  getPlan,
  getPlanPrice,
  type BillingInterval,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { addBillingPeriod, hasPaidAccess } from "@/lib/subscription";
import { qualifyReferralForUser, attachReferralOnSignup, normalizeReferralCode, validateReferralCodeForUser } from "@/lib/referral";
import {
  calculateCreditApplication,
  getReferralCreditBalance,
  spendReferralCredits,
} from "@/lib/referral-credits";
import {
  createSdkOrder,
  getSdkOrder,
  isSdkOrderPaid,
  type PokPaySdkOrderProduct,
} from "@/lib/pokpay/client";
import { getAppBaseUrl } from "@/lib/app-url";
import type { Profile } from "@/lib/types";
import { getSubscriptionRequiredMessage } from "@/lib/subscription-messages";

export async function getSubscriptionProfile(): Promise<Profile | null> {
  return getCachedProfile();
}

export async function ensureSubscribedMutation(): Promise<
  { profile: Profile } | { error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { error: "Not authenticated" };
  if (hasPaidAccess(profile)) return { profile };
  const locale = parseCheckoutLocale(profile.preferred_locale);
  return { error: getSubscriptionRequiredMessage(locale) };
}

async function completeSubscriptionOrder(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    orderId: string;
    userId: string;
    plan: string;
    billingInterval: BillingInterval;
    creditsToSpend: number;
    pokpayOrderId: string | null;
  }
): Promise<{ success: true } | { error: string }> {
  const now = new Date();
  const expiresAt = addBillingPeriod(now, args.billingInterval);

  await admin
    .from("profiles")
    .update({
      subscription_plan: args.plan,
      subscription_status: "active",
      subscription_interval: args.billingInterval,
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", args.userId);

  if (args.creditsToSpend > 0) {
    await spendReferralCredits(
      args.userId,
      args.orderId,
      args.creditsToSpend,
      "Applied referral credits to subscription payment"
    );
  }

  const orderUpdate: Record<string, unknown> = {
    status: "completed",
    completed_at: now.toISOString(),
  };
  if (args.pokpayOrderId) {
    orderUpdate.pokpay_order_id = args.pokpayOrderId;
  }

  await admin.from("subscription_orders").update(orderUpdate).eq("id", args.orderId);

  await qualifyReferralForUser(args.userId, {
    id: args.orderId,
    plan: args.plan,
    billing_interval: args.billingInterval,
    pokpay_order_id: args.pokpayOrderId,
  });

  return { success: true };
}

export async function createCheckoutOrder(
  planId: SubscriptionPlanId,
  interval: BillingInterval,
  referralCode?: string | null
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const code = normalizeReferralCode(referralCode);
  if (code) {
    const validation = await validateReferralCodeForUser(user.id, code);
    if ("error" in validation) {
      if (validation.error === "own_referral_code") {
        return { error: "own_referral_code" };
      }
      return { error: "invalid_referral_code" };
    }
    await attachReferralOnSignup(supabase, user.id, code);
  }

  const plan = getPlan(planId);
  if (!plan) return { error: "Invalid plan" };

  const price = getPlanPrice(planId, interval);
  const creditBalance = await getReferralCreditBalance(user.id);
  const creditApplication = calculateCreditApplication(price.amountCents, creditBalance);
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
      amount_cents: creditApplication.originalAmountCents,
      referral_credits_applied_cents: creditApplication.creditsAppliedCents,
      currency_code: CHECKOUT_CURRENCY,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  if (creditApplication.chargeAmountCents === 0) {
    const activated = await completeSubscriptionOrder(admin, {
      orderId: orderRow.id,
      userId: user.id,
      plan: planId,
      billingInterval: interval,
      creditsToSpend: creditApplication.creditsAppliedCents,
      pokpayOrderId: null,
    });
    if ("error" in activated) {
      await admin
        .from("subscription_orders")
        .update({ status: "failed" })
        .eq("id", orderRow.id);
      return activated;
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pricing");
    revalidatePath("/dashboard/checkout");
    revalidatePath("/dashboard/referrals");
    revalidatePath("/dashboard/profile");

    return {
      localOrderId: orderRow.id,
      orderId: null,
      amountCents: 0,
      creditsAppliedCents: creditApplication.creditsAppliedCents,
      planId,
      interval,
      planName: plan.name,
      priceLabel: price.label,
      paidWithCredits: true,
    };
  }

  try {
    const redirectUrl = `${baseUrl}/dashboard/checkout/success?localOrderId=${orderRow.id}`;
    const failRedirectUrl = `${baseUrl}/dashboard/checkout?plan=${planId}&interval=${interval}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const products: PokPaySdkOrderProduct[] = [
      {
        name: `${plan.name} · ${interval === "monthly" ? "Monthly" : "Annual"}`,
        quantity: 1,
        price: creditApplication.chargeAmountCents,
      },
    ];
    const sdkOrder = await createSdkOrder({
      amountCents: creditApplication.chargeAmountCents,
      currencyCode: CHECKOUT_CURRENCY,
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
      amountCents: creditApplication.chargeAmountCents,
      creditsAppliedCents: creditApplication.creditsAppliedCents,
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
    .select(
      "id, user_id, plan, billing_interval, status, pokpay_order_id, amount_cents, referral_credits_applied_cents, created_at"
    )
    .eq("id", localOrderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { error: "Order not found" };
  if (order.status === "completed") {
    return { success: true, alreadyCompleted: true };
  }

  const creditsToSpend = order.referral_credits_applied_cents ?? 0;

  if (creditsToSpend > 0 && !order.pokpay_order_id) {
    const result = await completeSubscriptionOrder(admin, {
      orderId: order.id,
      userId: user.id,
      plan: order.plan,
      billingInterval: order.billing_interval as BillingInterval,
      creditsToSpend,
      pokpayOrderId: null,
    });
    if ("error" in result) return result;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pricing");
    revalidatePath("/dashboard/checkout");
    revalidatePath("/dashboard/referrals");
    revalidatePath("/dashboard/profile");

    return { success: true };
  }

  if (!order.pokpay_order_id) return { error: "Payment not started" };

  try {
    const sdkOrder = await getSdkOrder(order.pokpay_order_id);
    if (!isSdkOrderPaid(sdkOrder)) {
      return { error: "Payment not completed yet" };
    }

    const result = await completeSubscriptionOrder(admin, {
      orderId: order.id,
      userId: user.id,
      plan: order.plan,
      billingInterval: order.billing_interval as BillingInterval,
      creditsToSpend,
      pokpayOrderId: order.pokpay_order_id,
    });
    if ("error" in result) return result;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pricing");
    revalidatePath("/dashboard/checkout");
    revalidatePath("/dashboard/referrals");
    revalidatePath("/dashboard/profile");

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify payment",
    };
  }
}

export async function cancelSubscription(): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_status, subscription_expires_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.subscription_status !== "active") {
    return { error: "No active subscription to cancel." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ subscription_status: "canceled" })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/pricing");

  return { success: true };
}

export async function activateSubscriptionFromPokPayOrder(pokpayOrderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select(
      "id, user_id, plan, billing_interval, status, pokpay_order_id, order_kind, amount_cents, referral_credits_applied_cents, created_at"
    )
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

  await completeSubscriptionOrder(admin, {
    orderId: order.id,
    userId: order.user_id,
    plan: order.plan,
    billingInterval: order.billing_interval as BillingInterval,
    creditsToSpend: order.referral_credits_applied_cents ?? 0,
    pokpayOrderId,
  });
}
