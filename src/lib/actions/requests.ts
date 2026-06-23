"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PlanRequestType } from "@/lib/types";

export async function createPlanRequest(type: PlanRequestType, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("plan_requests")
    .select("id")
    .eq("client_id", user.id)
    .eq("type", type)
    .in("status", ["pending", "in_progress"])
    .maybeSingle();

  if (existing) return { error: "You already have a pending request for this plan type" };

  const { data: request, error } = await supabase
    .from("plan_requests")
    .insert({ client_id: user.id, type, notes: notes ?? null })
    .select()
    .single();

  if (error) return { error: error.message };

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins?.length) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: "plan_request",
      title: `New ${type} plan request`,
      body: `A client has requested a ${type} plan.`,
      metadata: { request_id: request.id, client_id: user.id, type },
    }));
    await supabase.from("notifications").insert(notifications);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateRequestStatus(
  requestId: string,
  status: "pending" | "in_progress" | "completed"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_requests")
    .update({ status })
    .eq("id", requestId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  return { success: true };
}

export async function getClientRequests(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getPendingRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_requests")
    .select("*, profiles(full_name)")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false });
  return data ?? [];
}
