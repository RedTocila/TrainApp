"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";
import { formatUserError } from "@/lib/format-user-error";
import {
  decryptPendingPassword,
  encryptPendingPassword,
} from "@/lib/pending-signup-crypto";
import { CHECKOUT_CURRENCY } from "@/lib/checkout-i18n";
import {
  getPlan,
  getPlanPrice,
  type BillingInterval,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { applyOfferDiscount, pickBestOffer } from "@/lib/subscription-offers";
import { buildFreeTrialGrant } from "@/lib/subscription";
import {
  createSdkOrder,
  getSdkOrder,
  isSdkOrderPaid,
  tokenizeGuestCard,
  type PokPayAddCardPayload,
  type PokPaySdkOrderProduct,
} from "@/lib/pokpay/client";
import { applyIntakeToProfile } from "@/lib/actions/client-intake";
import type { IntakeResponses } from "@/lib/intake-questionnaire";

export type GuestSignupPayload = {
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
  intakeJson?: string | null;
  referralCode?: string | null;
};

type PendingSignupRow = {
  id: string;
  email: string;
  password_encrypted: string;
  full_name: string;
  phone: string | null;
  intake_json: string | null;
  referral_code: string | null;
  expires_at: string;
  consumed_at: string | null;
  consumed_user_id: string | null;
};

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const normalized = email.trim().toLowerCase();
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("[findAuthUserIdByEmail] failed", error.message);
        return null;
      }
      const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
      if (match) return match.id;
      if (data.users.length < 200) break;
    }
    return null;
  } catch (err) {
    console.error("[findAuthUserIdByEmail] threw", err);
    return null;
  }
}

/** True when this email can start a new package-gated signup. */
export async function checkSignupEmailAvailable(email: string): Promise<
  { available: true } | { available: false; error: string }
> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { available: false, error: "Enter a valid email address." };
  }
  const existing = await findAuthUserIdByEmail(normalized);
  if (existing) {
    return {
      available: false,
      error: "This email is already registered. Sign in to continue.",
    };
  }
  return { available: true };
}

async function upsertPendingSignup(input: GuestSignupPayload): Promise<
  { pendingSignupId: string } | { error: string }
> {
  const email = input.email.trim().toLowerCase();
  const availability = await checkSignupEmailAvailable(email);
  if (!availability.available) return { error: availability.error };

  const admin = createAdminClient();
  const passwordEncrypted = encryptPendingPassword(input.password);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    email,
    password_encrypted: passwordEncrypted,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    intake_json: input.intakeJson?.trim() || null,
    referral_code: input.referralCode?.trim() || null,
    expires_at: expiresAt,
  };

  const { data, error } = await admin
    .from("pending_signups")
    .insert(payload)
    .select("id")
    .single();

  // Race-safe path: another request inserted an active row first.
  if (
    error?.message?.includes("pending_signups_active_email_idx") ||
    error?.code === "23505"
  ) {
    const { data: existing, error: existingError } = await admin
      .from("pending_signups")
      .select("id")
      .eq("email", email)
      .is("consumed_at", null)
      .maybeSingle();

    if (existingError || !existing?.id) {
      return {
        error: formatUserError(existingError?.message, "Could not save your signup details."),
      };
    }

    const { error: updateError } = await admin
      .from("pending_signups")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) {
      return {
        error: formatUserError(updateError.message, "Could not save your signup details."),
      };
    }

    return { pendingSignupId: existing.id };
  }

  if (error || !data) {
    return {
      error: formatUserError(error?.message, "Could not save your signup details."),
    };
  }

  return { pendingSignupId: data.id };
}

async function loadPendingSignup(id: string): Promise<PendingSignupRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pending_signups")
    .select(
      "id, email, password_encrypted, full_name, phone, intake_json, referral_code, expires_at, consumed_at, consumed_user_id"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as PendingSignupRow | null) ?? null;
}

async function ensureProfileRow(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  input: { fullName: string; email: string; phone: string | null }
) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) break;
    await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
  }

  const role =
    process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL ? "admin" : "client";
  const referralCode = Math.random().toString(36).slice(2, 10);

  await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: input.fullName || input.email.split("@")[0] || "Member",
      role,
      referral_code: referralCode,
      subscription_status: "inactive",
      phone: input.phone,
    },
    { onConflict: "id" }
  );

  const profileUpdate: { full_name: string; phone?: string; role?: string } = {
    full_name: input.fullName,
  };
  if (input.phone) profileUpdate.phone = input.phone;
  if (role === "admin") profileUpdate.role = "admin";

  await admin.from("profiles").update(profileUpdate).eq("id", userId);
}

async function applyIntakeIfPresent(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  intakeJson: string | null
) {
  const raw = intakeJson?.trim();
  if (!raw) return;
  try {
    const intakeResponses = JSON.parse(raw) as IntakeResponses;
    await applyIntakeToProfile(userId, admin, intakeResponses);
  } catch (err) {
    console.error("[applyIntakeIfPresent]", err);
  }
}

/**
 * Create auth user + profile from a pending signup after package purchase/trial.
 * Idempotent when the pending row was already consumed.
 */
export async function createAccountFromPendingSignup(
  pendingSignupId: string
): Promise<{ userId: string; email: string; password: string } | { error: string }> {
  const pending = await loadPendingSignup(pendingSignupId);
  if (!pending) return { error: "Signup details expired. Please register again." };

  if (pending.consumed_at && pending.consumed_user_id) {
    const password = decryptPendingPassword(pending.password_encrypted);
    return {
      userId: pending.consumed_user_id,
      email: pending.email,
      password,
    };
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return { error: "Signup details expired. Please register again." };
  }

  const existing = await findAuthUserIdByEmail(pending.email);
  if (existing) {
    return {
      error: "This email is already registered. Sign in to continue.",
    };
  }

  const password = decryptPendingPassword(pending.password_encrypted);
  const admin = createAdminClient();

  const userMetadata: Record<string, string> = {
    full_name: pending.full_name,
  };
  if (pending.phone) userMetadata.phone = pending.phone;
  if (pending.referral_code) userMetadata.referral_code = pending.referral_code;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: pending.email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createError || !created.user) {
    // Race: email registered between check and create.
    if (createError?.message?.toLowerCase().includes("already")) {
      return {
        error: "This email is already registered. Sign in to continue.",
      };
    }
    return {
      error: formatUserError(createError?.message, "Could not create your account."),
    };
  }

  const userId = created.user.id;

  await ensureProfileRow(admin, userId, {
    fullName: pending.full_name,
    email: pending.email,
    phone: pending.phone,
  });
  await applyIntakeIfPresent(admin, userId, pending.intake_json);

  if (pending.referral_code) {
    try {
      const { applyReferralCodeForUser } = await import("@/lib/actions/referrals");
      await applyReferralCodeForUser(userId, pending.referral_code);
    } catch {
      // Non-blocking
    }
  }

  await admin
    .from("pending_signups")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_user_id: userId,
    })
    .eq("id", pending.id);

  return { userId, email: pending.email, password };
}

async function signInCreatedUser(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: formatUserError(error.message, "Account created but sign-in failed.") };
  }
  return { success: true as const };
}

function revalidateJoinPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pricing");
  revalidatePath("/join/pricing");
  revalidatePath("/join/checkout");
}

/** Start PokPay checkout for a not-yet-created account. */
export async function createGuestCheckoutOrder(
  signup: GuestSignupPayload,
  planId: SubscriptionPlanId,
  interval: BillingInterval
) {
  const plan = getPlan(planId);
  if (!plan) return { error: "Invalid plan" };
  if (planId !== "ai" && planId !== "elite") {
    return { error: "That plan is no longer available. Choose AI Pro or Elite." };
  }
  if (interval !== "monthly" && interval !== "annual") {
    return { error: "Invalid billing interval" };
  }

  const price = getPlanPrice(planId, interval);
  if (!price) return { error: "Invalid plan" };
  const admin = createAdminClient();
  let offerDiscountCents = 0;
  let offerBadge: string | null = null;
  try {
    const { data: offers } = await admin
      .from("subscription_offers")
      .select("*")
      .eq("active", true);
    const bestOffer = pickBestOffer((offers as any[]) ?? [], planId, interval);
    const discounted = applyOfferDiscount(price.amountCents, bestOffer);
    offerDiscountCents = Math.max(0, price.amountCents - discounted);
    offerBadge = bestOffer?.badge_text ?? null;
  } catch {
    // Offers table may not exist yet; proceed with list price.
  }
  const finalAmountCents = Math.max(0, price.amountCents - offerDiscountCents);

  const pending = await upsertPendingSignup(signup);
  if ("error" in pending) return pending;

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
      user_id: null,
      pending_signup_id: pending.pendingSignupId,
      plan: planId,
      billing_interval: interval,
      amount_cents: finalAmountCents,
      currency_code: CHECKOUT_CURRENCY,
      status: "pending",
      order_kind: "subscription",
      invitee_discount_cents: 0,
      referral_credits_applied_cents: 0,
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  try {
    const redirectUrl = `${baseUrl}/join/checkout/success?localOrderId=${orderRow.id}`;
    const failRedirectUrl = `${baseUrl}/join/checkout?plan=${planId}&interval=${interval}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const products: PokPaySdkOrderProduct[] = [
      {
        name: `${plan.name} · ${interval === "monthly" ? "Monthly" : "Annual"}`,
        quantity: 1,
        price: finalAmountCents,
      },
    ];
    const sdkOrder = await createSdkOrder({
      amountCents: finalAmountCents,
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
      pendingSignupId: pending.pendingSignupId,
      amountCents: price.amountCents,
      finalAmountCents,
      planId,
      interval,
      planName: plan.name,
      priceLabel: price.label,
      offerDiscountCents,
      offerBadge,
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

async function completePaidGuestOrder(localOrderId: string): Promise<
  | { success: true; email: string; password: string; alreadyCompleted?: boolean }
  | { error: string }
> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select(
      "id, user_id, pending_signup_id, plan, billing_interval, status, pokpay_order_id, amount_cents, referral_credits_applied_cents"
    )
    .eq("id", localOrderId)
    .maybeSingle();

  if (!order) return { error: "Order not found" };
  if (!order.pending_signup_id && !order.user_id) {
    return { error: "Order is missing signup details." };
  }

  if (order.status === "completed" && order.user_id) {
    const pending = order.pending_signup_id
      ? await loadPendingSignup(order.pending_signup_id)
      : null;
    if (pending) {
      const password = decryptPendingPassword(pending.password_encrypted);
      return {
        success: true,
        alreadyCompleted: true,
        email: pending.email,
        password,
      };
    }
    return { error: "Order already completed. Please sign in." };
  }

  if (!order.pokpay_order_id) {
    return { error: "Payment not started" };
  }

  try {
    const sdkOrder = await getSdkOrder(order.pokpay_order_id);
    if (!isSdkOrderPaid(sdkOrder)) {
      return { error: "Payment not completed yet" };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not verify payment",
    };
  }

  let userId = order.user_id as string | null;
  let email = "";
  let password = "";

  if (order.pending_signup_id) {
    const created = await createAccountFromPendingSignup(order.pending_signup_id);
    if ("error" in created) return created;
    userId = created.userId;
    email = created.email;
    password = created.password;
  }

  if (!userId) return { error: "Could not create account for this order." };

  const now = new Date();
  const { addBillingPeriod } = await import("@/lib/subscription");
  const expiresAt = addBillingPeriod(now, order.billing_interval as BillingInterval);

  await admin
    .from("profiles")
    .update({
      subscription_plan: order.plan,
      subscription_status: "active",
      subscription_interval: order.billing_interval,
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", userId);

  await admin
    .from("subscription_orders")
    .update({
      user_id: userId,
      status: "completed",
      completed_at: now.toISOString(),
      pokpay_order_id: order.pokpay_order_id,
    })
    .eq("id", order.id);

  if (order.pending_signup_id) {
    const pending = await loadPendingSignup(order.pending_signup_id);
    if (pending?.referral_code) {
      try {
        const { grantInviterCreditForSubscription } = await import("@/lib/actions/referrals");
        await grantInviterCreditForSubscription(admin, {
          referredUserId: userId,
          orderId: order.id,
        });
      } catch {
        // Non-blocking
      }
    }
  }

  return { success: true, email, password };
}

/** Confirm guest payment, create account, and establish a session. */
export async function completeGuestCheckoutAndSignIn(localOrderId: string) {
  const result = await completePaidGuestOrder(localOrderId);
  if ("error" in result) return result;

  const signedIn = await signInCreatedUser(result.email, result.password);
  if ("error" in signedIn) return signedIn;

  revalidateJoinPaths();
  return { success: true as const };
}

/** Webhook / server path: create account if needed and activate subscription. */
export async function activateGuestSubscriptionFromOrder(localOrderId: string) {
  const result = await completePaidGuestOrder(localOrderId);
  if ("error" in result) {
    console.error("[activateGuestSubscriptionFromOrder]", result.error);
    return;
  }
  revalidateJoinPaths();
}

/** Card-backed AI Pro trial for a not-yet-created account. */
export async function startGuestAiProTrial(params: {
  signup: GuestSignupPayload;
  interval: BillingInterval;
  cardPayload: PokPayAddCardPayload;
}): Promise<{ success: true } | { error: string }> {
  const interval = params.interval;
  if (interval !== "monthly" && interval !== "annual") {
    return { error: "Invalid billing interval." };
  }

  const pending = await upsertPendingSignup(params.signup);
  if ("error" in pending) return pending;

  try {
    const card = await tokenizeGuestCard(params.cardPayload);
    const created = await createAccountFromPendingSignup(pending.pendingSignupId);
    if ("error" in created) return created;

    const admin = createAdminClient();
    const grant = buildFreeTrialGrant(new Date(), interval);

    const { error } = await admin
      .from("profiles")
      .update({
        ...grant,
        pokpay_card_id: card.id,
        trial_converted_at: null,
      })
      .eq("id", created.userId);

    if (error) return { error: error.message };

    const signedIn = await signInCreatedUser(created.email, created.password);
    if ("error" in signedIn) return signedIn;

    revalidateJoinPaths();
    return { success: true };
  } catch (err) {
    console.error("[startGuestAiProTrial]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not start your free trial. Please try again.",
    };
  }
}
