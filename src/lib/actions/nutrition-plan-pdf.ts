"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRAINER_NAME } from "@/lib/custom-plan-products";
import {
  STORAGE_BUCKETS,
  nutritionPlanPdfPath,
} from "@/lib/supabase/storage";

const DELIVERABLE_STATUSES = ["pending", "awaiting_approval", "in_progress"] as const;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function requireAdminUserId(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };
  return { userId: user.id };
}

export async function uploadAndSendNutritionPlanPdf(
  requestId: string,
  clientId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const adminCheck = await requireAdminUserId();
  if ("error" in adminCheck) return adminCheck;

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed" };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "PDF must be 10 MB or smaller" };
  }

  const admin = createAdminClient();
  const { data: request, error: fetchError } = await admin
    .from("plan_requests")
    .select("*")
    .eq("id", requestId)
    .eq("client_id", clientId)
    .eq("type", "diet")
    .single();

  if (fetchError || !request) {
    return { error: fetchError?.message ?? "Plan request not found" };
  }

  if (!DELIVERABLE_STATUSES.includes(request.status as (typeof DELIVERABLE_STATUSES)[number])) {
    return {
      error: `Cannot send plan while request is "${request.status.replace(/_/g, " ")}".`,
    };
  }

  const storagePath = nutritionPlanPdfPath(clientId, requestId);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.nutritionPlanPdfs)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });

  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await admin
    .from("plan_requests")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivered_nutrition_pdf_path: storagePath,
    })
    .eq("id", requestId);

  if (updateError) return { error: updateError.message };

  try {
    await admin.rpc("notify_user", {
      p_user_id: clientId,
      p_type: "plan_delivered",
      p_title: "Your nutrition plan is ready",
      p_body: `${TRAINER_NAME} sent your custom nutrition plan PDF. Open it from the Nutrition tab.`,
      p_metadata: { request_id: requestId, type: "diet" },
    });
  } catch {
    // Delivery succeeded; notification is best-effort.
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}

export async function getNutritionPlanPdfSignedUrl(
  requestId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: request } = await supabase
    .from("plan_requests")
    .select("client_id, delivered_nutrition_pdf_path, status, type")
    .eq("id", requestId)
    .single();

  if (!request || request.type !== "diet" || !request.delivered_nutrition_pdf_path) {
    return { error: "Plan PDF not found" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isOwner = request.client_id === user.id;

  if (!isAdmin && !isOwner) return { error: "Unauthorized" };

  if (!isAdmin && !["delivered", "implemented", "completed"].includes(request.status)) {
    return { error: "Plan not available yet" };
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.nutritionPlanPdfs)
    .createSignedUrl(request.delivered_nutrition_pdf_path, 3600);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not load PDF" };
  }

  return { url: data.signedUrl };
}

export async function getActiveTrainerNutritionPdfRequestId(
  clientId: string
): Promise<string | null> {
  const state = await getCoachNutritionPlanViewState(clientId);
  return state.mode === "pdf" ? state.requestId : null;
}

export type CoachNutritionPlanViewState =
  | { mode: "pdf"; requestId: string }
  | { mode: "awaiting_pdf" }
  | { mode: "none" };

/** Coach PDF plan delivered, waiting on PDF, or neither (personal / no coach plan). */
export async function getCoachNutritionPlanViewState(
  clientId: string
): Promise<CoachNutritionPlanViewState> {
  const supabase = await createClient();

  const { data: pdfRequest } = await supabase
    .from("plan_requests")
    .select("id")
    .eq("client_id", clientId)
    .eq("type", "diet")
    .not("delivered_nutrition_pdf_path", "is", null)
    .in("status", ["delivered", "implemented", "completed"])
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pdfRequest) {
    return { mode: "pdf", requestId: pdfRequest.id };
  }

  const [{ data: assignment }, { data: openDietRequest }] = await Promise.all([
    supabase
      .from("nutrition_assignments")
      .select("nutrition_plans(is_personal)")
      .eq("client_id", clientId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("plan_requests")
      .select("id")
      .eq("client_id", clientId)
      .eq("type", "diet")
      .is("delivered_nutrition_pdf_path", null)
      .in("status", [
        "pending",
        "awaiting_approval",
        "in_progress",
        "delivered",
      ])
      .limit(1)
      .maybeSingle(),
  ]);

  const coachPlanAssigned =
    assignment?.nutrition_plans &&
    !(assignment.nutrition_plans as { is_personal?: boolean }).is_personal;

  if (coachPlanAssigned || openDietRequest) {
    return { mode: "awaiting_pdf" };
  }

  return { mode: "none" };
}
