"use server";

import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/actions/auth";
import {
  countChallengeParticipants,
} from "@/lib/challenge-slot-management";
import { getChallengeEntryFeeCents, isFlashChallenge } from "@/lib/challenge-series";
import {
  canRegisterForChallenge,
  getChallengeStatus,
} from "@/lib/challenge-utils";
import {
  flashParticipantNeedsPayment,
  flashRequiresPaymentOnJoin,
  flashGroupSize,
  type FlashEntryAction,
} from "@/lib/flash-challenge-entry-fee";
import { CHECKOUT_CURRENCY } from "@/lib/checkout-i18n";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  createSdkOrder,
  getSdkOrder,
  isSdkOrderPaid,
  type PokPaySdkOrderProduct,
} from "@/lib/pokpay/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { onFlashChallengeParticipantJoined } from "@/lib/actions/challenge-bracket";
import { hasEliteAccess } from "@/lib/subscription";
import type { Challenge } from "@/lib/types";

function rowToChallenge(row: Record<string, unknown>): Challenge {
  return {
    ...(row as unknown as Challenge),
    group_size: typeof row.group_size === "number" ? row.group_size : 10,
    is_flash: row.is_flash === true,
    entry_fee_cents: typeof row.entry_fee_cents === "number" ? row.entry_fee_cents : 0,
    registration_opens_at: (row.registration_opens_at as string | null) ?? null,
    registration_closes_at: (row.registration_closes_at as string | null) ?? null,
  };
}

function revalidateFlashChallenge(challenge: Pick<Challenge, "id" | "slug">) {
  revalidatePath(`/dashboard/challenges/${challenge.slug}`);
  revalidatePath("/dashboard/classes");
  revalidatePath(`/admin/challenges/${challenge.id}/bracket`);
}

export async function createFlashChallengeEntryCheckout(
  challengeId: string,
  action: FlashEntryAction
) {
  const profile = await requireClient();
  if (!hasEliteAccess(profile)) {
    return { error: "Elite membership is required to join community challenges." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: challengeRow } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow?.published) {
    return { error: "Challenge not found." };
  }

  const challenge = rowToChallenge(challengeRow);
  if (!isFlashChallenge(challenge)) {
    return { error: "This checkout is only for flash challenges." };
  }

  if (!canRegisterForChallenge(challenge)) {
    return { error: "Registration is not open right now." };
  }

  const groupSize = flashGroupSize(challenge);
  const participantCount = await countChallengeParticipants(supabase, challengeId);
  const entryFeeCents = getChallengeEntryFeeCents(challenge);

  if (action === "join") {
    if (!flashRequiresPaymentOnJoin(participantCount, groupSize)) {
      return {
        error:
          "The first group still has free seats — reserve yours without paying first.",
      };
    }

    const { data: existingParticipant } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existingParticipant) {
      return { error: "You are already registered." };
    }
  } else {
    const { data: participant } = await supabase
      .from("challenge_participants")
      .select("id, created_at, entry_fee_paid_at")
      .eq("challenge_id", challengeId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!participant) {
      return { error: "Register for the challenge before paying the entry fee." };
    }

    const { data: allParticipants } = await supabase
      .from("challenge_participants")
      .select("id, created_at, entry_fee_paid_at")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: true });

    if (
      !flashParticipantNeedsPayment(
        {
          id: participant.id,
          created_at: participant.created_at as string,
          entry_fee_paid_at: (participant.entry_fee_paid_at as string | null) ?? null,
        },
        (allParticipants ?? []).map((row) => ({
          id: row.id as string,
          created_at: row.created_at as string,
          entry_fee_paid_at: (row.entry_fee_paid_at as string | null) ?? null,
        })),
        groupSize
      )
    ) {
      return { error: "Entry fee is not required right now." };
    }
  }

  const baseUrl = getAppBaseUrl();
  const { data: orderRow, error: insertError } = await admin
    .from("subscription_orders")
    .insert({
      user_id: profile.id,
      plan: "core",
      billing_interval: "monthly",
      amount_cents: entryFeeCents,
      currency_code: CHECKOUT_CURRENCY,
      status: "pending",
      order_kind: "flash_challenge_entry",
      metadata: {
        challenge_id: challengeId,
        challenge_slug: challenge.slug,
        challenge_title: challenge.title,
        action,
      },
    })
    .select("id")
    .single();

  if (insertError || !orderRow) {
    return { error: insertError?.message ?? "Could not start checkout" };
  }

  try {
    const redirectUrl = `${baseUrl}/dashboard/checkout/flash-challenge/success?localOrderId=${orderRow.id}`;
    const failRedirectUrl = `${baseUrl}/dashboard/checkout/flash-challenge?localOrderId=${orderRow.id}`;
    const webhookUrl = `${baseUrl}/api/payments/pokpay/webhook`;
    const products: PokPaySdkOrderProduct[] = [
      {
        name: `${challenge.title} · entry fee`,
        quantity: 1,
        price: entryFeeCents,
      },
    ];
    const sdkOrder = await createSdkOrder({
      amountCents: entryFeeCents,
      currencyCode: CHECKOUT_CURRENCY,
      redirectUrl,
      failRedirectUrl,
      webhookUrl,
      description: `${challenge.title} flash challenge entry`,
      merchantCustomReference: orderRow.id,
      products,
    });

    await admin
      .from("subscription_orders")
      .update({ pokpay_order_id: sdkOrder.id })
      .eq("id", orderRow.id);

    return {
      localOrderId: orderRow.id,
      checkoutUrl: `/dashboard/checkout/flash-challenge?localOrderId=${orderRow.id}`,
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

async function completeFlashChallengeEntryOrder(order: {
  id: string;
  user_id: string;
  status: string;
  pokpay_order_id: string | null;
  metadata: Record<string, unknown> | null;
}) {
  if (order.status === "completed") {
    return { success: true, alreadyCompleted: true as const };
  }
  if (!order.pokpay_order_id) {
    return { error: "Payment not started" };
  }

  const admin = createAdminClient();
  const sdkOrder = await getSdkOrder(order.pokpay_order_id);
  if (!isSdkOrderPaid(sdkOrder)) {
    return { error: "Payment not completed yet" };
  }

  const metadata = (order.metadata ?? {}) as {
    challenge_id?: string;
    challenge_slug?: string;
    action?: FlashEntryAction;
  };

  const challengeId = metadata.challenge_id;
  const action = metadata.action ?? "join";
  if (!challengeId) return { error: "Invalid order metadata" };

  const { data: challengeRow } = await admin
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challengeRow) return { error: "Challenge not found" };
  const challenge = rowToChallenge(challengeRow);

  if (getChallengeStatus(challenge) === "ended") {
    return { error: "This challenge has ended." };
  }

  const paidAt = new Date().toISOString();

  if (action === "confirm") {
    const { data: participant } = await admin
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (!participant) {
      return { error: "Participant record not found." };
    }

    await admin
      .from("challenge_participants")
      .update({ entry_fee_paid_at: paidAt })
      .eq("id", participant.id);
  } else {
    const { data: existingParticipant } = await admin
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (existingParticipant) {
      await admin
        .from("challenge_participants")
        .update({ entry_fee_paid_at: paidAt })
        .eq("id", existingParticipant.id);
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", order.user_id)
        .maybeSingle();

      const { error: insertError } = await admin.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: order.user_id,
        display_name: profile?.full_name?.trim() || "Participant",
        status: "active",
        entry_fee_paid_at: paidAt,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          await admin
            .from("challenge_participants")
            .update({ entry_fee_paid_at: paidAt })
            .eq("challenge_id", challengeId)
            .eq("user_id", order.user_id);
        } else {
          return { error: insertError.message };
        }
      }

      await admin
        .from("challenge_waitlist")
        .delete()
        .eq("challenge_id", challengeId)
        .eq("user_id", order.user_id);
    }
  }

  await admin
    .from("subscription_orders")
    .update({ status: "completed", completed_at: paidAt })
    .eq("id", order.id);

  if (action === "join") {
    const { data: participant } = await admin
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (participant?.id) {
      await onFlashChallengeParticipantJoined(admin, challengeId, participant.id as string);
    }
  }

  revalidateFlashChallenge(challenge);

  return {
    success: true,
    challengeSlug: metadata.challenge_slug ?? challenge.slug,
  };
}

export async function activateFlashChallengeEntryFromLocalOrder(localOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("id, user_id, status, pokpay_order_id, metadata, order_kind")
    .eq("id", localOrderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { error: "Order not found" };
  if (order.order_kind !== "flash_challenge_entry") {
    return { error: "Not a flash challenge entry order" };
  }

  return completeFlashChallengeEntryOrder({
    id: order.id,
    user_id: order.user_id,
    status: order.status as string,
    pokpay_order_id: order.pokpay_order_id as string | null,
    metadata: (order.metadata as Record<string, unknown> | null) ?? null,
  });
}

export async function activateFlashChallengeEntryFromPokPayOrder(pokpayOrderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("id, user_id, status, pokpay_order_id, metadata, order_kind")
    .eq("pokpay_order_id", pokpayOrderId)
    .maybeSingle();

  if (!order || order.order_kind !== "flash_challenge_entry") return;
  if (order.status === "completed") return;

  await completeFlashChallengeEntryOrder({
    id: order.id,
    user_id: order.user_id,
    status: order.status as string,
    pokpay_order_id: order.pokpay_order_id as string | null,
    metadata: (order.metadata as Record<string, unknown> | null) ?? null,
  });
}
