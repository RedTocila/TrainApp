import { createAdminClient } from "@/lib/supabase/admin";
import {
  MONTHLY_SUBSCRIPTION_CENTS,
  REFERRAL_CREDIT_CENTS,
} from "@/lib/referral-config";

export type CreditApplication = {
  originalAmountCents: number;
  creditsAppliedCents: number;
  chargeAmountCents: number;
  remainingBalanceCents: number;
};

export function calculateCreditApplication(
  amountCents: number,
  balanceCents: number
): CreditApplication {
  const creditsAppliedCents = Math.min(balanceCents, amountCents);
  return {
    originalAmountCents: amountCents,
    creditsAppliedCents,
    chargeAmountCents: amountCents - creditsAppliedCents,
    remainingBalanceCents: balanceCents - creditsAppliedCents,
  };
}

export function formatEurosFromCents(cents: number): string {
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export async function getReferralCreditBalance(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents")
    .eq("id", userId)
    .single();
  return data?.referral_credit_balance_cents ?? 0;
}

export async function grantReferralCredit(
  userId: string,
  referralId: string,
  amountCents: number,
  description: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents, referral_credits_earned_cents")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const newBalance = (profile.referral_credit_balance_cents ?? 0) + amountCents;
  const newEarned = (profile.referral_credits_earned_cents ?? 0) + amountCents;

  await admin
    .from("profiles")
    .update({
      referral_credit_balance_cents: newBalance,
      referral_credits_earned_cents: newEarned,
    })
    .eq("id", userId);

  await admin.from("referral_credit_transactions").insert({
    user_id: userId,
    referral_id: referralId,
    amount_cents: amountCents,
    type: "earn",
    description,
  });
}

export async function spendReferralCredits(
  userId: string,
  orderId: string,
  amountCents: number,
  description: string
): Promise<void> {
  if (amountCents <= 0) return;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents, referral_money_saved_cents")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const balance = profile.referral_credit_balance_cents ?? 0;
  if (balance < amountCents) {
    throw new Error("Insufficient referral credits");
  }

  await admin
    .from("profiles")
    .update({
      referral_credit_balance_cents: balance - amountCents,
      referral_money_saved_cents:
        (profile.referral_money_saved_cents ?? 0) + amountCents,
    })
    .eq("id", userId);

  await admin.from("referral_credit_transactions").insert({
    user_id: userId,
    order_id: orderId,
    amount_cents: -amountCents,
    type: "spend",
    description,
  });
}

export async function revokeReferralCredit(
  userId: string,
  referralId: string,
  amountCents: number,
  description: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents, referral_credits_earned_cents")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const balance = profile.referral_credit_balance_cents ?? 0;
  const earned = profile.referral_credits_earned_cents ?? 0;

  await admin
    .from("profiles")
    .update({
      referral_credit_balance_cents: Math.max(0, balance - amountCents),
      referral_credits_earned_cents: Math.max(0, earned - amountCents),
    })
    .eq("id", userId);

  await admin.from("referral_credit_transactions").insert({
    user_id: userId,
    referral_id: referralId,
    amount_cents: -amountCents,
    type: "revoke",
    description,
  });
}

export { REFERRAL_CREDIT_CENTS, MONTHLY_SUBSCRIPTION_CENTS };
