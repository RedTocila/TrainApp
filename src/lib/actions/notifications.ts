"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildCursorPage,
  decodeCursor,
  type CursorPage,
} from "@/lib/pagination";
import { NOTIFICATION_COLUMNS } from "@/lib/db-selects";
import type { Notification } from "@/lib/types";

export async function getNotifications(userId: string) {
  const page = await getNotificationsPage(userId, { limit: 20 });
  return page.items;
}

export async function getNotificationsPage(
  userId: string,
  options?: { cursor?: string; limit?: number }
): Promise<CursorPage<Notification>> {
  const supabase = await createClient();
  const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
  const decoded = decodeCursor(options?.cursor);

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (decoded) {
    query = query.or(
      `created_at.lt.${decoded.sortValue},and(created_at.eq.${decoded.sortValue},id.lt.${decoded.id})`
    );
  }

  const { data } = await query;
  return buildCursorPage((data ?? []) as Notification[], limit, (n) => n.created_at);
}

export async function getUnreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  revalidatePath("/admin");
}

export async function markAllRead(userId: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  revalidatePath("/admin");
}
