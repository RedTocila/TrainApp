"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/auth";
import {
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";

export async function getAdminNotifications(): Promise<Notification[]> {
  const profile = await requireAdmin();
  return getNotifications(profile.id);
}

export async function markAdminNotificationRead(id: string) {
  await requireAdmin();
  await markNotificationRead(id);
  revalidatePath("/admin", "layout");
}

export async function markAdminNotificationsAllRead() {
  const profile = await requireAdmin();
  await markAllRead(profile.id);
  revalidatePath("/admin", "layout");
}
