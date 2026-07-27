"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import {
  INVITEE_DISCOUNT_CENTS,
  INVITER_CREDIT_CENTS,
  normalizeReferralCode,
  referralEarnDescription,
  referralShareUrl,
  referralSpendDescription,
} from "@/lib/referral";
import { getPlatformCopy } from "@/lib/platform-copy";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ReferralDashboard = {
  code: string;
  shareUrl: string;
  balanceCents: number;
  earnedCents: number;
  savedCents: number;
  qualifiedCount: number;
  pendingCount: number;
  referredByCode: string | null;
  canApplyCode: boolean;
  transactions: {
    id: string;
    amountCents: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
};

async function hasCompletedPaidSubscription(
  admin: AdminClient,
  userId: string
): Promise<boolean> {
  const { count } = await admin
    .from("subscription_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .or("order_kind.eq.subscription,order_kind.is.null");
  return (count ?? 0) > 0;
}

export async function getReferralDashboard(): Promise<
  ReferralDashboard | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "referral_code, referred_by, referral_credit_balance_cents, referral_credits_earned_cents, referral_money_saved_cents, preferred_locale"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.referral_code) {
    return { error: "Referral profile not ready" };
  }

  const [{ count: qualifiedCount }, { count: pendingCount }, { data: txs }, referrer] =
    await Promise.all([
      admin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .eq("status", "qualified"),
      admin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .eq("status", "pending"),
      admin
        .from("referral_credit_transactions")
        .select("id, amount_cents, type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      profile.referred_by
        ? admin
            .from("profiles")
            .select("referral_code")
            .eq("id", profile.referred_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const paid = await hasCompletedPaidSubscription(admin, user.id);

  return {
    code: profile.referral_code as string,
    shareUrl: referralShareUrl(profile.referral_code as string, getAppBaseUrl()),
    balanceCents: profile.referral_credit_balance_cents ?? 0,
    earnedCents: profile.referral_credits_earned_cents ?? 0,
    savedCents: profile.referral_money_saved_cents ?? 0,
    qualifiedCount: qualifiedCount ?? 0,
    pendingCount: pendingCount ?? 0,
    referredByCode: referrer.data?.referral_code ?? null,
    canApplyCode: !profile.referred_by && !paid,
    transactions: (txs ?? []).map((tx) => ({
      id: tx.id as string,
      amountCents: tx.amount_cents as number,
      type: tx.type as string,
      description: tx.description as string,
      createdAt: tx.created_at as string,
    })),
  };
}

/** Link current user to a referrer. Idempotent if already linked to same. */
/** Link a referral for a known user id (used after deferred guest signup). */
export async function applyReferralCodeForUser(
  userId: string,
  rawCode: string
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("id, referral_code, referred_by, preferred_locale")
    .eq("id", userId)
    .maybeSingle();

  if (!me) return { error: "Profile not found" };

  const locale = parseCheckoutLocale(me.preferred_locale);
  const copy = getPlatformCopy(locale).referral;
  const code = normalizeReferralCode(rawCode);
  if (!code) return { error: copy.invalidCode };

  if (me.referral_code && me.referral_code === code) {
    return { error: copy.cannotSelfRefer };
  }

  if (me.referred_by) {
    return { error: copy.alreadyReferred };
  }

  if (await hasCompletedPaidSubscription(admin, userId)) {
    return { error: copy.tooLate };
  }

  const { data: referrer } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer || referrer.id === userId) {
    return { error: copy.invalidCode };
  }

  const { error: linkError } = await admin
    .from("profiles")
    .update({ referred_by: referrer.id })
    .eq("id", userId)
    .is("referred_by", null);

  if (linkError) return { error: linkError.message };

  const { error: insertError } = await admin.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: userId,
    status: "pending",
  });

  if (insertError && insertError.code !== "23505") {
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/referrals");
  revalidatePath("/dashboard/checkout");
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function applyReferralCode(rawCode: string): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  return applyReferralCodeForUser(user.id, rawCode);
}

export async function getCheckoutReferralState(userId: string): Promise<{
  canApplyInviteeDiscount: boolean;
  inviteeDiscountCents: number;
  creditBalanceCents: number;
  referredBy: string | null;
  canApplyCode: boolean;
}> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by, referral_credit_balance_cents")
    .eq("id", userId)
    .maybeSingle();

  const paid = await hasCompletedPaidSubscription(admin, userId);
  const referredBy = (profile?.referred_by as string | null) ?? null;
  const canApplyInviteeDiscount = Boolean(referredBy) && !paid;

  return {
    canApplyInviteeDiscount,
    inviteeDiscountCents: canApplyInviteeDiscount ? INVITEE_DISCOUNT_CENTS : 0,
    creditBalanceCents: profile?.referral_credit_balance_cents ?? 0,
    referredBy,
    canApplyCode: !referredBy && !paid,
  };
}

/** Deduct credits after a successful order that reserved them. */
export async function settleReferralCreditsSpend(
  admin: AdminClient,
  args: {
    userId: string;
    orderId: string;
    amountCents: number;
    description: string;
  }
): Promise<void> {
  if (args.amountCents <= 0) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents, referral_money_saved_cents")
    .eq("id", args.userId)
    .maybeSingle();

  if (!profile) return;

  const balance = profile.referral_credit_balance_cents ?? 0;
  const spend = Math.min(balance, args.amountCents);
  if (spend <= 0) return;

  await admin
    .from("profiles")
    .update({
      referral_credit_balance_cents: balance - spend,
      referral_money_saved_cents:
        (profile.referral_money_saved_cents ?? 0) + spend,
    })
    .eq("id", args.userId);

  await admin.from("referral_credit_transactions").insert({
    user_id: args.userId,
    order_id: args.orderId,
    amount_cents: -spend,
    type: "spend",
    description: args.description,
  });
}

/** Grant inviter €10 when invitee completes first paid subscription. Idempotent. */
export async function grantInviterCreditForSubscription(
  admin: AdminClient,
  args: { referredUserId: string; orderId: string }
): Promise<void> {
  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, status, credit_granted_cents")
    .eq("referred_id", args.referredUserId)
    .maybeSingle();

  if (!referral) return;
  if (referral.status === "qualified" && (referral.credit_granted_cents ?? 0) > 0) {
    return;
  }

  const { data: referrer } = await admin
    .from("profiles")
    .select("referral_credit_balance_cents, referral_credits_earned_cents, preferred_locale")
    .eq("id", referral.referrer_id)
    .maybeSingle();

  if (!referrer) return;

  const locale = parseCheckoutLocale(referrer.preferred_locale);
  const now = new Date().toISOString();

  await admin
    .from("profiles")
    .update({
      referral_credit_balance_cents:
        (referrer.referral_credit_balance_cents ?? 0) + INVITER_CREDIT_CENTS,
      referral_credits_earned_cents:
        (referrer.referral_credits_earned_cents ?? 0) + INVITER_CREDIT_CENTS,
    })
    .eq("id", referral.referrer_id);

  await admin
    .from("referrals")
    .update({
      status: "qualified",
      qualifying_order_id: args.orderId,
      credit_granted_cents: INVITER_CREDIT_CENTS,
      credit_granted_at: now,
      qualified_at: now,
    })
    .eq("id", referral.id);

  await admin.from("referral_credit_transactions").insert({
    user_id: referral.referrer_id,
    referral_id: referral.id,
    order_id: args.orderId,
    amount_cents: INVITER_CREDIT_CENTS,
    type: "earn",
    description: referralEarnDescription(locale),
  });
}

export async function spendDescriptionForOrder(
  locale: ReturnType<typeof parseCheckoutLocale>,
  kind: "subscription" | "flash"
): Promise<string> {
  const copy = getPlatformCopy(locale).referral;
  return kind === "flash" ? copy.flashSpendTx : referralSpendDescription(locale);
}
