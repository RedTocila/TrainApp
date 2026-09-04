"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/auth";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import type { BillingInterval, SoldSubscriptionPlanId } from "@/lib/subscription-plans";
import {
  applyOfferDiscount,
  pickBestOffer,
  type OfferInterval,
  type SubscriptionOffer,
} from "@/lib/subscription-offers";

type OfferRow = {
  id: string;
  name: string;
  plan_id: SoldSubscriptionPlanId;
  billing_interval: OfferInterval;
  percent_off: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  badge_text: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

const OFFER_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const OFFER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function isMissingTable(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";
  return /relation .*subscription_offers.* does not exist/i.test(message);
}

export async function getAdminSubscriptionOffers(): Promise<{
  offers: SubscriptionOffer[];
  warning?: string;
}> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_offers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return {
        offers: [],
        warning:
          "Table subscription_offers is missing. Create it to enable persistent offers.",
      };
    }
    return { offers: [], warning: error.message };
  }

  return { offers: ((data ?? []) as OfferRow[]).map((row) => ({ ...row })) };
}

export async function getPublicActiveSubscriptionOffers(): Promise<SubscriptionOffer[]> {
  // Public RLS allows select where active = true — no service-role key needed.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_offers")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) return [];
    return [];
  }

  return ((data ?? []) as OfferRow[]).map((row) => ({ ...row }));
}

export async function upsertSubscriptionOffer(input: {
  id?: string;
  name: string;
  planId: SoldSubscriptionPlanId;
  interval: OfferInterval;
  percentOff: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  badgeText?: string | null;
  imageUrl?: string | null;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const row: OfferRow = {
    id: input.id ?? randomUUID(),
    name: input.name.trim(),
    plan_id: input.planId,
    billing_interval: input.interval,
    percent_off: Math.max(1, Math.min(100, Math.round(input.percentOff))),
    starts_at: input.startsAt?.trim() || null,
    ends_at: input.endsAt?.trim() || null,
    active: input.active ?? true,
    badge_text: input.badgeText?.trim() || null,
    image_url: input.imageUrl?.trim() || null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("subscription_offers")
    .upsert(row, { onConflict: "id" });

  if (error) {
    if (isMissingTable(error)) {
      return {
        error:
          "subscription_offers table is missing. Run migration: supabase/migrations/20260729_subscription_offers.sql",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/offers");
  revalidatePath("/dashboard/pricing");
  revalidatePath("/join/pricing");
  revalidatePath("/register");
  revalidatePath("/join/checkout");
  revalidatePath("/pricing");
  revalidatePath("/");
  return { success: true };
}

export async function uploadSubscriptionOfferImage(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { error: "Please choose an image file." };
  }
  if (!OFFER_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return { error: "Image must be JPG, PNG, WebP, or GIF." };
  }
  if (file.size > OFFER_IMAGE_MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `offers/${Date.now()}-${randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(STORAGE_BUCKETS.blogImages)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) return { error: error.message };
  const { data } = admin.storage.from(STORAGE_BUCKETS.blogImages).getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function deleteSubscriptionOffer(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("subscription_offers").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      return {
        error:
          "subscription_offers table is missing. Run migration: supabase/migrations/20260729_subscription_offers.sql",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/admin/offers");
  revalidatePath("/dashboard/pricing");
  revalidatePath("/join/pricing");
  revalidatePath("/register");
  revalidatePath("/join/checkout");
  revalidatePath("/pricing");
  revalidatePath("/");
  return { success: true };
}

export async function getBestPublicOfferForPlan(
  planId: SoldSubscriptionPlanId,
  interval: BillingInterval
) {
  const offers = await getPublicActiveSubscriptionOffers();
  return pickBestOffer(offers, planId, interval);
}

export async function getDiscountedPlanPrice(
  baseAmountCents: number,
  planId: SoldSubscriptionPlanId,
  interval: BillingInterval
) {
  const best = await getBestPublicOfferForPlan(planId, interval);
  return {
    offer: best,
    amountCents: applyOfferDiscount(baseAmountCents, best),
  };
}
