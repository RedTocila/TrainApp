"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  createSdkOrder,
  guestConfirmSdkOrder,
  getSdkOrder,
  isSdkOrderPaid,
  setupTokenized3ds,
  tokenizeGuestCard,
  type PokPayAddCardPayload,
} from "@/lib/pokpay/client";
import {
  buildFreeTrialGrant,
  FREE_TRIAL_PLAN_ID,
  isEligibleForAiProTrial,
  addBillingPeriod,
} from "@/lib/subscription";
import { getPlan, getPlanPrice, type BillingInterval } from "@/lib/subscription-plans";
import { CHECKOUT_CURRENCY } from "@/lib/checkout-i18n";

function revalidateTrialPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pricing");
  revalidatePath("/dashboard/checkout");
  revalidatePath("/dashboard/checkout/trial");
  revalidatePath("/dashboard/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
}

/**
 * Save PokPay card (no charge) and start the 7-day AI Pro free trial.
 * After trial ends, cron charges the saved card for the chosen interval.
 */
export async function startAiProTrialWithCard(params: {
  interval: BillingInterval;
  cardPayload: PokPayAddCardPayload;
}): Promise<{ success: true } | { error: string }> {
  const interval = params.interval;
  if (interval !== "monthly" && interval !== "annual") {
    return { error: "Invalid billing interval." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, role, trial_started_at, subscription_status, subscription_expires_at, pokpay_card_id"
    )
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };
  if (!isEligibleForAiProTrial(profile)) {
    return {
      error: profile.trial_started_at
        ? "You've already used your free trial."
        : "You're already subscribed.",
    };
  }

  try {
    const card = await tokenizeGuestCard(params.cardPayload);
    const grant = buildFreeTrialGrant(new Date(), interval);

    const { error } = await admin
      .from("profiles")
      .update({
        ...grant,
        pokpay_card_id: card.id,
        trial_converted_at: null,
      })
      .eq("id", user.id);

    if (error) return { error: error.message };

    revalidateTrialPaths();
    return { success: true };
  } catch (err) {
    console.error("[startAiProTrialWithCard]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not save your card. Please try again.",
    };
  }
}

async function notifyTrialChargeFailed(admin: ReturnType<typeof createAdminClient>, userId: string) {
  await admin.from("notifications").insert({
    user_id: userId,
    type: "subscription",
    title: "Trial ended — payment needed",
    body: "We couldn't charge your card for AI Pro. Update your payment method on Pricing to keep access.",
    metadata: { kind: "trial_charge_failed" },
    read: false,
  });
}

/**
 * Charge vaulted cards for AI Pro trials that have ended.
 * Safe to run repeatedly (idempotent via trial_converted_at + status checks).
 */
export async function chargeEndedAiProTrials(): Promise<{
  checked: number;
  charged: number;
  failed: number;
  skipped: number;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("profiles")
    .select(
      "id, subscription_interval, subscription_expires_at, pokpay_card_id, trial_converted_at, preferred_locale"
    )
    .eq("role", "client")
    .eq("subscription_status", "trialing")
    .eq("subscription_plan", FREE_TRIAL_PLAN_ID)
    .is("trial_converted_at", null)
    .lte("subscription_expires_at", nowIso)
    .limit(50);

  const rows = due ?? [];
  let charged = 0;
  let failed = 0;
  let skipped = 0;

  const baseUrl = getAppBaseUrl();
  const plan = getPlan(FREE_TRIAL_PLAN_ID);
  const planName = plan?.name ?? "AI Pro";

  for (const row of rows) {
    const cardId = row.pokpay_card_id as string | null;
    const interval =
      row.subscription_interval === "annual" ? ("annual" as const) : ("monthly" as const);

    // Legacy auto-trials (no card): expire access without charging.
    if (!cardId) {
      await admin
        .from("profiles")
        .update({
          subscription_status: "inactive",
          subscription_plan: null,
          subscription_interval: null,
          subscription_expires_at: nowIso,
        })
        .eq("id", row.id);
      skipped += 1;
      continue;
    }

    const price = getPlanPrice(FREE_TRIAL_PLAN_ID, interval);
    if (!price) {
      skipped += 1;
      continue;
    }

    try {
      const { data: order, error: orderError } = await admin
        .from("subscription_orders")
        .insert({
          user_id: row.id,
          plan: FREE_TRIAL_PLAN_ID,
          billing_interval: interval,
          amount_cents: price.amountCents,
          currency: CHECKOUT_CURRENCY,
          status: "pending",
          order_kind: "trial_conversion",
        })
        .select("id")
        .single();

      if (orderError || !order) {
        console.error("[chargeEndedAiProTrials] order insert", orderError);
        failed += 1;
        continue;
      }

      const sdkOrder = await createSdkOrder({
        amountCents: price.amountCents,
        currencyCode: CHECKOUT_CURRENCY,
        redirectUrl: `${baseUrl}/dashboard/pricing`,
        failRedirectUrl: `${baseUrl}/dashboard/pricing`,
        webhookUrl: `${baseUrl}/api/payments/pokpay/webhook`,
        merchantCustomReference: order.id,
        description: `${planName} after free trial (${interval})`,
        products: [
          {
            name: `${planName} · ${interval}`,
            quantity: 1,
            price: price.amountCents,
          },
        ],
      });

      await admin
        .from("subscription_orders")
        .update({ pokpay_order_id: sdkOrder.id })
        .eq("id", order.id);

      const setup = await setupTokenized3ds({
        cardId,
        sdkOrderId: sdkOrder.id,
      });

      await guestConfirmSdkOrder({
        sdkOrderId: sdkOrder.id,
        cardId,
        consumerAuthenticationInformation: setup.payerAuthentication ?? setup,
      });

      const paidOrder = await getSdkOrder(sdkOrder.id);
      if (!isSdkOrderPaid(paidOrder)) {
        throw new Error(`Order ${sdkOrder.id} not paid after confirm`);
      }

      const expiresAt = addBillingPeriod(new Date(), interval).toISOString();
      await admin
        .from("profiles")
        .update({
          subscription_plan: FREE_TRIAL_PLAN_ID,
          subscription_status: "active",
          subscription_interval: interval,
          subscription_expires_at: expiresAt,
          trial_converted_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await admin
        .from("subscription_orders")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      charged += 1;
    } catch (err) {
      console.error("[chargeEndedAiProTrials] failed for", row.id, err);
      failed += 1;

      await admin
        .from("profiles")
        .update({
          subscription_status: "past_due",
          subscription_plan: null,
          subscription_interval: null,
          subscription_expires_at: nowIso,
        })
        .eq("id", row.id);

      try {
        await notifyTrialChargeFailed(admin, row.id);
      } catch (notifyErr) {
        console.error("[chargeEndedAiProTrials] notify failed", notifyErr);
      }
    }
  }

  if (charged > 0 || failed > 0) {
    revalidateTrialPaths();
  }

  return {
    checked: rows.length,
    charged,
    failed,
    skipped,
  };
}
