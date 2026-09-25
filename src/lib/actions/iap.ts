"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKOUT_CURRENCY } from "@/lib/checkout-i18n";
import {
  getPlan,
  getPlanPrice,
  isSoldPlanId,
  type BillingInterval,
  type SoldSubscriptionPlanId,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { addBillingPeriod } from "@/lib/subscription";
import { getIapProductId, parseIapProductId } from "@/lib/iap/products";
import { verifyAppleTransactionJws } from "@/lib/iap/verify";
import type { GuestSignupPayload } from "@/lib/actions/guest-signup";

function revalidateSubscriptionPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pricing");
  revalidatePath("/dashboard/checkout");
  revalidatePath("/dashboard/profile");
}

async function activateFromVerifiedApple(args: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  userId: string;
  plan: string;
  billingInterval: BillingInterval;
  transactionId: string;
  originalTransactionId: string;
  expiresDateMs: number | null;
  referralCreditsAppliedCents?: number;
  preferredLocale?: string | null;
}): Promise<{ success: true; alreadyCompleted?: boolean } | { error: string }> {
  const now = new Date();
  const expiresAt = args.expiresDateMs
    ? new Date(args.expiresDateMs)
    : addBillingPeriod(now, args.billingInterval);

  if (expiresAt.getTime() <= now.getTime()) {
    return { error: "This Apple subscription has already expired." };
  }

  const { data: claimed, error: claimError } = await args.admin
    .from("subscription_orders")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      payment_provider: "apple",
      apple_transaction_id: args.transactionId,
      apple_original_transaction_id: args.originalTransactionId,
      user_id: args.userId,
    })
    .eq("id", args.orderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError) return { error: claimError.message };
  if (!claimed) {
    const { data: existing } = await args.admin
      .from("subscription_orders")
      .select("status")
      .eq("id", args.orderId)
      .maybeSingle();
    if (existing?.status === "completed") {
      return { success: true, alreadyCompleted: true };
    }
    return { error: "Order could not be completed" };
  }

  const { error: profileError } = await args.admin
    .from("profiles")
    .update({
      subscription_plan: args.plan,
      subscription_status: "active",
      subscription_interval: args.billingInterval,
      subscription_expires_at: expiresAt.toISOString(),
      apple_original_transaction_id: args.originalTransactionId,
    })
    .eq("id", args.userId);

  if (profileError) return { error: profileError.message };

  const {
    settleReferralCreditsSpend,
    grantInviterCreditForSubscription,
    spendDescriptionForOrder,
  } = await import("@/lib/actions/referrals");
  const { parseCheckoutLocale } = await import("@/lib/checkout-i18n");

  const locale = parseCheckoutLocale(args.preferredLocale);
  await settleReferralCreditsSpend(args.admin, {
    userId: args.userId,
    orderId: args.orderId,
    amountCents: args.referralCreditsAppliedCents ?? 0,
    description: await spendDescriptionForOrder(locale, "subscription"),
  });

  await grantInviterCreditForSubscription(args.admin, {
    referredUserId: args.userId,
    orderId: args.orderId,
  });

  return { success: true };
}

/** Create a pending Apple IAP order for an authenticated client (no PokPay). */
export async function createAppleCheckoutOrder(
  planId: SubscriptionPlanId,
  interval: BillingInterval,
  options?: { referralCode?: string }
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isSoldPlanId(planId)) {
    return { error: "That plan is no longer available. Choose AI Pro or Elite." };
  }
  if (interval !== "monthly" && interval !== "annual") {
    return { error: "Invalid billing interval" };
  }

  const plan = getPlan(planId);
  if (!plan) return { error: "Invalid plan" };
  const price = getPlanPrice(planId, interval);
  if (!price) return { error: "Invalid plan" };

  if (options?.referralCode?.trim()) {
    const { applyReferralCode, getCheckoutReferralState } = await import(
      "@/lib/actions/referrals"
    );
    const applied = await applyReferralCode(options.referralCode);
    if ("error" in applied && applied.error) {
      const state = await getCheckoutReferralState(user.id);
      if (!state.referredBy) {
        return { error: applied.error };
      }
    }
  }

  const productId = getIapProductId(planId as SoldSubscriptionPlanId, interval);

  const { data: orderRow, error: insertError } = await admin
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      plan: planId,
      billing_interval: interval,
      amount_cents: price.amountCents,
      currency_code: CHECKOUT_CURRENCY,
      status: "pending",
      order_kind: "subscription",
      payment_provider: "apple",
      invitee_discount_cents: 0,
      referral_credits_applied_cents: 0,
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start Apple checkout" };
  }

  return {
    localOrderId: orderRow.id,
    productId,
    appAccountToken: user.id,
    planId,
    interval,
    planName: plan.name,
    priceLabel: price.label,
  };
}

export type CompleteApplePurchaseInput = {
  localOrderId: string;
  productId: string;
  signedTransaction: string;
};

/** Verify StoreKit transaction and activate the pending authenticated order. */
export async function completeAppleCheckoutPurchase(input: CompleteApplePurchaseInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select(
      "id, user_id, plan, billing_interval, status, payment_provider, amount_cents, referral_credits_applied_cents, apple_transaction_id"
    )
    .eq("id", input.localOrderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return { error: "Order not found" };
  if (order.status === "completed") {
    return { success: true as const, alreadyCompleted: true };
  }

  let verified;
  try {
    verified = await verifyAppleTransactionJws(input.signedTransaction);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify Apple purchase",
    };
  }

  if (verified.productId !== input.productId) {
    return { error: "Product mismatch for this Apple purchase." };
  }

  if (
    verified.appAccountToken &&
    verified.appAccountToken.toLowerCase() !== user.id.toLowerCase()
  ) {
    return { error: "Apple purchase is bound to a different account." };
  }

  if (!verified.transactionId.trim()) {
    return { error: "Apple transaction is missing a transaction id." };
  }

  const parsed = parseIapProductId(verified.productId);
  if (!parsed) return { error: "Unknown Apple product." };
  if (parsed.planId !== order.plan || parsed.interval !== order.billing_interval) {
    return { error: "Apple product does not match this order." };
  }

  const { data: existingTxn } = await admin
    .from("subscription_orders")
    .select("id")
    .eq("apple_transaction_id", verified.transactionId)
    .neq("id", order.id)
    .maybeSingle();
  if (existingTxn) {
    return { error: "This Apple transaction was already used." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("preferred_locale")
    .eq("id", user.id)
    .maybeSingle();

  const result = await activateFromVerifiedApple({
    admin,
    orderId: order.id,
    userId: user.id,
    plan: order.plan,
    billingInterval: order.billing_interval as BillingInterval,
    transactionId: verified.transactionId,
    originalTransactionId: verified.originalTransactionId,
    expiresDateMs: verified.expiresDate,
    referralCreditsAppliedCents: order.referral_credits_applied_cents ?? 0,
    preferredLocale: profile?.preferred_locale,
  });

  if ("error" in result) return result;
  revalidateSubscriptionPaths();
  return { success: true as const };
}

/** Guest signup: create pending Apple order (no PokPay). */
export async function startGuestAppleCheckout(
  signup: GuestSignupPayload,
  planId: SubscriptionPlanId,
  interval: BillingInterval
) {
  const { createGuestAppleCheckoutOrder } = await import("@/lib/actions/guest-signup");
  return createGuestAppleCheckoutOrder(signup, planId, interval);
}

/** Guest signup: verify Apple purchase, create account, sign in. */
export async function completeGuestAppleCheckout(input: {
  localOrderId: string;
  productId: string;
  signedTransaction: string;
}) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select(
      "id, user_id, pending_signup_id, plan, billing_interval, status, payment_provider, apple_transaction_id"
    )
    .eq("id", input.localOrderId)
    .maybeSingle();

  if (!order) return { error: "Order not found" };
  if (!order.pending_signup_id && !order.user_id) {
    return { error: "Order is missing signup details." };
  }

  let verified;
  try {
    verified = await verifyAppleTransactionJws(input.signedTransaction);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify Apple purchase",
    };
  }

  if (verified.productId !== input.productId) {
    return { error: "Product mismatch for this Apple purchase." };
  }

  if (!verified.transactionId.trim()) {
    return { error: "Apple transaction is missing a transaction id." };
  }

  const parsed = parseIapProductId(verified.productId);
  if (!parsed) return { error: "Unknown Apple product." };
  if (parsed.planId !== order.plan || parsed.interval !== order.billing_interval) {
    return { error: "Apple product does not match this order." };
  }

  const { data: existingTxn } = await admin
    .from("subscription_orders")
    .select("id")
    .eq("apple_transaction_id", verified.transactionId)
    .neq("id", order.id)
    .maybeSingle();
  if (existingTxn) {
    return { error: "This Apple transaction was already used." };
  }

  await admin
    .from("subscription_orders")
    .update({
      payment_provider: "apple",
      apple_transaction_id: verified.transactionId,
      apple_original_transaction_id: verified.originalTransactionId,
    })
    .eq("id", order.id);

  const { completeGuestOrderAfterApplePayment } = await import(
    "@/lib/actions/guest-signup"
  );
  return completeGuestOrderAfterApplePayment({
    localOrderId: order.id,
    expiresDateMs: verified.expiresDate,
    originalTransactionId: verified.originalTransactionId,
  });
}

/**
 * Restore: verify a StoreKit entitlement JWS and activate/extend the signed-in user.
 * Creates a completed Apple order if one does not already exist for this transaction.
 */
export async function syncAppleEntitlementFromSignedTransaction(input: {
  signedTransaction: string;
}): Promise<{ success: true; alreadyActive?: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let verified;
  try {
    verified = await verifyAppleTransactionJws(input.signedTransaction);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify Apple purchase",
    };
  }

  if (
    verified.appAccountToken &&
    verified.appAccountToken.toLowerCase() !== user.id.toLowerCase()
  ) {
    return { error: "Apple purchase is bound to a different account." };
  }

  const parsed = parseIapProductId(verified.productId);
  if (!parsed) return { error: "Unknown Apple product." };

  const admin = createAdminClient();

  const { data: existingTxn } = await admin
    .from("subscription_orders")
    .select("id, status, user_id")
    .eq("apple_transaction_id", verified.transactionId)
    .maybeSingle();

  if (existingTxn?.status === "completed") {
    if (existingTxn.user_id && existingTxn.user_id !== user.id) {
      return { error: "This Apple transaction belongs to another account." };
    }
    // Refresh expiry on profile from the verified receipt.
    const expiresAt = verified.expiresDate
      ? new Date(verified.expiresDate)
      : addBillingPeriod(new Date(), parsed.interval);
    await admin
      .from("profiles")
      .update({
        subscription_plan: parsed.planId,
        subscription_status: "active",
        subscription_interval: parsed.interval,
        subscription_expires_at: expiresAt.toISOString(),
        apple_original_transaction_id: verified.originalTransactionId,
      })
      .eq("id", user.id);
    revalidateSubscriptionPaths();
    return { success: true, alreadyActive: true };
  }

  if (existingTxn?.status === "pending" && existingTxn.user_id === user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("preferred_locale")
      .eq("id", user.id)
      .maybeSingle();
    const result = await activateFromVerifiedApple({
      admin,
      orderId: existingTxn.id,
      userId: user.id,
      plan: parsed.planId,
      billingInterval: parsed.interval,
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      expiresDateMs: verified.expiresDate,
      preferredLocale: profile?.preferred_locale,
    });
    if ("error" in result) return result;
    revalidateSubscriptionPaths();
    return { success: true };
  }

  const price = getPlanPrice(parsed.planId, parsed.interval);
  const { data: orderRow, error: insertError } = await admin
    .from("subscription_orders")
    .insert({
      user_id: user.id,
      plan: parsed.planId,
      billing_interval: parsed.interval,
      amount_cents: price?.amountCents ?? 0,
      currency_code: CHECKOUT_CURRENCY,
      status: "pending",
      order_kind: "subscription",
      payment_provider: "apple",
      apple_transaction_id: verified.transactionId,
      apple_original_transaction_id: verified.originalTransactionId,
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not create restore order" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("preferred_locale")
    .eq("id", user.id)
    .maybeSingle();

  const result = await activateFromVerifiedApple({
    admin,
    orderId: orderRow.id,
    userId: user.id,
    plan: parsed.planId,
    billingInterval: parsed.interval,
    transactionId: verified.transactionId,
    originalTransactionId: verified.originalTransactionId,
    expiresDateMs: verified.expiresDate,
    preferredLocale: profile?.preferred_locale,
  });

  if ("error" in result) return result;
  revalidateSubscriptionPaths();
  return { success: true };
}
