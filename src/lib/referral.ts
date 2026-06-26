import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NEW_USER_REFERRAL_BONUS_DAYS,
  REFERRAL_CREDIT_CENTS,
  orderQualifiesReferral,
} from "@/lib/referral-config";
import {
  grantReferralCredit,
  revokeReferralCredit,
} from "@/lib/referral-credits";
import { getAmbassadorTier } from "@/lib/referral-rewards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEurosFromCents } from "@/lib/referral-credits";

function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function normalizeReferralCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function validateReferralCodeForUser(
  userId: string,
  referralCode: string
): Promise<{ ok: true } | { error: string }> {
  const code = normalizeReferralCode(referralCode);
  if (!code) return { error: "invalid_referral_code" };

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer) return { error: "invalid_referral_code" };
  if (referrer.id === userId) return { error: "own_referral_code" };

  return { ok: true };
}

export async function attachReferralOnSignup(
  supabase: SupabaseClient,
  userId: string,
  referralCode: string | null,
  deviceHash?: string | null
): Promise<void> {
  const code = normalizeReferralCode(referralCode);
  if (!code) return;

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer || referrer.id === userId) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .single();

  if (existing?.referred_by) return;

  const profileUpdate: { referred_by: string; signup_device_hash?: string } = {
    referred_by: referrer.id,
  };
  if (deviceHash?.trim()) {
    profileUpdate.signup_device_hash = deviceHash.trim();
  }

  await supabase.from("profiles").update(profileUpdate).eq("id", userId);

  await admin.from("referrals").upsert(
    {
      referrer_id: referrer.id,
      referred_id: userId,
      status: "pending",
    },
    { onConflict: "referred_id", ignoreDuplicates: true }
  );
}

type QualifyOrder = {
  id: string;
  plan: string;
  billing_interval: string;
  order_kind?: string | null;
  pokpay_order_id?: string | null;
};

async function passesAbuseChecks(
  referral: { id: string; referrer_id: string; referred_id: string },
  order: QualifyOrder
): Promise<{ ok: true; paymentFingerprint: string } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  const paymentFingerprint = order.pokpay_order_id?.trim() || order.id;

  const { data: duplicatePayment } = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_id", referral.referrer_id)
    .eq("payment_fingerprint", paymentFingerprint)
    .eq("status", "qualified")
    .neq("id", referral.id)
    .maybeSingle();

  if (duplicatePayment) {
    return { ok: false, reason: "duplicate_payment_fingerprint" };
  }

  const { data: referredProfile } = await admin
    .from("profiles")
    .select("signup_device_hash")
    .eq("id", referral.referred_id)
    .single();

  const deviceHash = referredProfile?.signup_device_hash?.trim();
  if (deviceHash) {
    const { data: duplicateDevice } = await admin
      .from("referrals")
      .select("id, referred_id")
      .eq("referrer_id", referral.referrer_id)
      .eq("status", "qualified")
      .neq("id", referral.id);

    if (duplicateDevice?.length) {
      const referredIds = duplicateDevice.map((row) => row.referred_id);
      const { data: profiles } = await admin
        .from("profiles")
        .select("id")
        .in("id", referredIds)
        .eq("signup_device_hash", deviceHash);

      if (profiles?.length) {
        return { ok: false, reason: "duplicate_device" };
      }
    }
  }

  return { ok: true, paymentFingerprint };
}

async function updateAmbassadorTier(referrerId: string): Promise<void> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .eq("status", "qualified");

  const tier = getAmbassadorTier(count ?? 0);
  await admin
    .from("profiles")
    .update({ ambassador_tier: tier?.tier ?? null })
    .eq("id", referrerId);
}

async function grantReferredUserBonus(referredUserId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_expires_at, subscription_status")
    .eq("id", referredUserId)
    .single();

  if (!profile || profile.subscription_status !== "active") return;

  const base = profile.subscription_expires_at
    ? new Date(Math.max(Date.now(), new Date(profile.subscription_expires_at).getTime()))
    : new Date();

  await admin
    .from("profiles")
    .update({
      subscription_expires_at: addDays(base, NEW_USER_REFERRAL_BONUS_DAYS).toISOString(),
    })
    .eq("id", referredUserId);

  await admin.from("notifications").insert({
    user_id: referredUserId,
    type: "referral_bonus",
    title: "Referral bonus unlocked",
    body: `You received ${NEW_USER_REFERRAL_BONUS_DAYS} extra days of Premium for joining through a referral.`,
    metadata: { bonus_days: NEW_USER_REFERRAL_BONUS_DAYS },
  });
}

export async function qualifyReferralForUser(
  userId: string,
  order?: QualifyOrder
): Promise<void> {
  if (order && !orderQualifiesReferral(order)) return;

  const admin = createAdminClient();

  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, referred_id, status, credit_granted_cents")
    .eq("referred_id", userId)
    .maybeSingle();

  if (!referral || referral.status === "qualified" || referral.status === "revoked") {
    return;
  }

  if (!order) return;

  const abuse = await passesAbuseChecks(referral, order);
  if (!abuse.ok) {
    console.warn("[referral] abuse check failed", abuse.reason, referral.id);
    return;
  }

  const now = new Date().toISOString();
  await admin
    .from("referrals")
    .update({
      status: "qualified",
      qualified_at: now,
      qualifying_order_id: order.id,
      payment_fingerprint: abuse.paymentFingerprint,
      credit_granted_cents: REFERRAL_CREDIT_CENTS,
      credit_granted_at: now,
    })
    .eq("id", referral.id);

  if ((referral.credit_granted_cents ?? 0) === 0) {
    const creditLabel = formatEurosFromCents(REFERRAL_CREDIT_CENTS);
    await grantReferralCredit(
      referral.referrer_id,
      referral.id,
      REFERRAL_CREDIT_CENTS,
      `Referral credit for a successful paying referral (${creditLabel})`
    );

    await admin.from("notifications").insert({
      user_id: referral.referrer_id,
      type: "referral_reward",
      title: "Referral credit earned",
      body: `A friend subscribed — you earned ${creditLabel} in referral credits.`,
      metadata: { amount_cents: REFERRAL_CREDIT_CENTS, referral_id: referral.id },
    });
  }

  await updateAmbassadorTier(referral.referrer_id);
  await grantReferredUserBonus(userId);
}

export async function revokeReferralForRefundedOrder(orderId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, status, credit_granted_cents")
    .eq("qualifying_order_id", orderId)
    .maybeSingle();

  if (!referral || referral.status !== "qualified") return;

  const creditAmount = referral.credit_granted_cents ?? REFERRAL_CREDIT_CENTS;
  if (creditAmount > 0) {
    await revokeReferralCredit(
      referral.referrer_id,
      referral.id,
      creditAmount,
      "Referral credit revoked due to subscription refund"
    );
  }

  await admin
    .from("referrals")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", referral.id);

  await updateAmbassadorTier(referral.referrer_id);
}
