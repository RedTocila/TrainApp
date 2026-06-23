"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/actions/auth";
import { markAllRead as markAllReadAction } from "@/lib/actions/notifications";

export async function markAllReadForm() {
  const profile = await requireAdmin();
  await markAllReadAction(profile.id);
  revalidatePath("/admin/requests");
}
