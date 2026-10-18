"use server";

import { revalidatePath } from "next/cache";
import {
  ACCOUNT_STORAGE_CLEANUP_ERROR,
  deleteUserOwnedStorage,
  userStorageClientFromAdmin,
} from "@/lib/account-storage";
import { requireAdmin } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Permanently deletes a client auth user and cascaded profile data.
 * Removes that client's storage files first. Personal plans are deleted next
 * because created_by has no ON DELETE CASCADE. A storage failure leaves the
 * account in place so deletion can be retried.
 */
export async function deleteClientAccount(clientId: string): Promise<void> {
  const adminProfile = await requireAdmin();
  if (clientId === adminProfile.id) {
    throw new Error("You cannot delete your own account.");
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", clientId)
    .maybeSingle();

  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("Client not found.");
  if (target.role !== "client") {
    throw new Error("Only client accounts can be deleted from here.");
  }

  const storageResult = await deleteUserOwnedStorage(
    userStorageClientFromAdmin(admin),
    clientId
  );
  if ("error" in storageResult) {
    throw new Error(storageResult.error || ACCOUNT_STORAGE_CLEANUP_ERROR);
  }

  // Personal plans reference profiles.created_by without cascade.
  const { error: workoutPlansError } = await admin
    .from("workout_plans")
    .delete()
    .eq("created_by", clientId);
  if (workoutPlansError) throw new Error(workoutPlansError.message);

  const { error: nutritionPlansError } = await admin
    .from("nutrition_plans")
    .delete()
    .eq("created_by", clientId);
  if (nutritionPlansError) throw new Error(nutritionPlansError.message);

  const { error: deleteError } = await admin.auth.admin.deleteUser(clientId);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}
