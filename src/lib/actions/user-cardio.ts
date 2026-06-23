"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSubscribedUserAccess } from "@/lib/actions/user-access";
import {
  generateRecurringScheduleDates,
  getScheduleAnchorDate,
  type ScheduleStartMode,
} from "@/lib/schedule-utils";
import { formatDateKey } from "@/lib/utils";
import type { ClientCardio, ScheduledCardio } from "@/lib/types";
import { isValidYoutubeUrl } from "@/lib/youtube";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

async function requireMutationUserId() {
  const access = await requireSubscribedUserAccess();
  if ("error" in access) throw new Error(access.error);
  return { supabase: access.supabase, userId: access.userId };
}

export interface SaveCardioInput {
  title: string;
  description?: string | null;
  youtubeUrl?: string | null;
  durationMinutes?: number | null;
}

export async function getClientCardioList(): Promise<ClientCardio[]> {
  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("client_cardio")
    .select("*")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []) as ClientCardio[];
}

export async function createClientCardio(input: SaveCardioInput) {
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const youtubeUrl = input.youtubeUrl?.trim() || null;
  if (youtubeUrl && !isValidYoutubeUrl(youtubeUrl)) {
    return { error: "Enter a valid YouTube URL" };
  }

  const duration = input.durationMinutes ?? null;
  if (duration != null && (!Number.isFinite(duration) || duration < 1 || duration > 300)) {
    return { error: "Duration must be between 1 and 300 minutes" };
  }

  const { supabase, userId } = await requireMutationUserId();
  const { data, error } = await supabase
    .from("client_cardio")
    .insert({
      client_id: userId,
      title,
      description: input.description?.trim() || null,
      youtube_url: youtubeUrl,
      duration_minutes: duration,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout/cardio");
  revalidatePath("/dashboard");
  return { data: data as ClientCardio };
}

export async function updateClientCardio(cardioId: string, input: SaveCardioInput) {
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const youtubeUrl = input.youtubeUrl?.trim() || null;
  if (youtubeUrl && !isValidYoutubeUrl(youtubeUrl)) {
    return { error: "Enter a valid YouTube URL" };
  }

  const duration = input.durationMinutes ?? null;
  if (duration != null && (!Number.isFinite(duration) || duration < 1 || duration > 300)) {
    return { error: "Duration must be between 1 and 300 minutes" };
  }

  const { supabase, userId } = await requireMutationUserId();
  const { data, error } = await supabase
    .from("client_cardio")
    .update({
      title,
      description: input.description?.trim() || null,
      youtube_url: youtubeUrl,
      duration_minutes: duration,
    })
    .eq("id", cardioId)
    .eq("client_id", userId)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout/cardio");
  revalidatePath("/dashboard");
  return { data: data as ClientCardio };
}

export async function deleteClientCardio(cardioId: string) {
  const { supabase, userId } = await requireMutationUserId();
  const { error } = await supabase
    .from("client_cardio")
    .delete()
    .eq("id", cardioId)
    .eq("client_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout/cardio");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function scheduleCardioSeries({
  cardioId,
  weekdays,
  weeks,
  startMode,
}: {
  cardioId: string;
  weekdays: number[];
  weeks: number;
  startMode: ScheduleStartMode;
}) {
  if (weekdays.length === 0) return { error: "Select at least one day" };

  const { supabase, userId } = await requireMutationUserId();

  const { data: cardio } = await supabase
    .from("client_cardio")
    .select("id")
    .eq("id", cardioId)
    .eq("client_id", userId)
    .single();

  if (!cardio) return { error: "Cardio not found" };

  const anchor = getScheduleAnchorDate(startMode);
  const dates = generateRecurringScheduleDates(anchor, weekdays, weeks);

  if (dates.length === 0) {
    return { error: "No dates to schedule. Check your day and week selections." };
  }

  const rows = dates.map((scheduled_date) => ({
    client_id: userId,
    scheduled_date,
    cardio_id: cardioId,
  }));

  const { error } = await supabase.from("scheduled_cardio").upsert(rows, {
    onConflict: "client_id,scheduled_date",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/workout/cardio");
  revalidatePath("/dashboard");
  return { success: true, count: dates.length };
}

export async function getScheduledCardioForDate(
  clientId: string,
  date: string
): Promise<ScheduledCardio | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_cardio")
    .select("*, client_cardio(*)")
    .eq("client_id", clientId)
    .eq("scheduled_date", date)
    .maybeSingle();

  return (data as ScheduledCardio | null) ?? null;
}

export async function getScheduledCardioInRange(
  from: string,
  to: string
): Promise<ScheduledCardio[]> {
  const { supabase, userId } = await requireUserId();
  const { data } = await supabase
    .from("scheduled_cardio")
    .select("*, client_cardio(*)")
    .eq("client_id", userId)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

  return (data ?? []) as ScheduledCardio[];
}
