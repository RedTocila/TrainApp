"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanRequest, Profile } from "@/lib/types";
import { subscriptionLabel } from "@/lib/subscription";
import { hasPaidAccess } from "@/lib/subscription";

export type RevenuePeriod = "1d" | "7d" | "30d" | "90d" | "all";

function periodStart(period: RevenuePeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  const days = period === "1d" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getAdminRevenue(period: RevenuePeriod = "30d") {
  const admin = createAdminClient();
  const start = periodStart(period);

  let query = admin
    .from("subscription_orders")
    .select("amount_cents, order_kind, completed_at, plan, billing_interval")
    .eq("status", "completed");

  if (start) {
    query = query.gte("completed_at", start.toISOString());
  }

  const { data: orders } = await query;

  const rows = orders ?? [];
  const totalCents = rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const subscriptionCents = rows
    .filter((row) => row.order_kind === "subscription")
    .reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const customCents = rows
    .filter((row) => row.order_kind !== "subscription")
    .reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);

  return {
    period,
    totalCents,
    subscriptionCents,
    customCents,
    orderCount: rows.length,
  };
}

export interface AdminClientRow extends Profile {
  email?: string;
  activeSubscription: boolean;
  subscriptionLabel: string;
  subscriptionExpiresAt: string | null;
  pendingRequests: PlanRequest[];
}

const OPEN_PLAN_REQUEST_STATUSES = [
  "pending",
  "awaiting_approval",
  "in_progress",
] as const;

export async function getOpenPlanRequestsByClient(): Promise<
  Record<string, PlanRequest[]>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("plan_requests")
    .select("*")
    .in("status", OPEN_PLAN_REQUEST_STATUSES as unknown as string[])
    .order("created_at", { ascending: false });

  const map: Record<string, PlanRequest[]> = {};
  for (const row of data ?? []) {
    const request = row as PlanRequest;
    if (!map[request.client_id]) map[request.client_id] = [];
    map[request.client_id].push(request);
  }
  return map;
}

export async function getAdminClientsWithSubscriptions(): Promise<AdminClientRow[]> {
  const admin = createAdminClient();
  const [clientsResult, requestsByClient] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    getOpenPlanRequestsByClient(),
  ]);

  const rows = (clientsResult.data ?? []).map((client) => {
    const profile = client as Profile;
    const pendingRequests = requestsByClient[profile.id] ?? [];
    return {
      ...profile,
      activeSubscription: hasPaidAccess(profile),
      subscriptionLabel: subscriptionLabel(
        profile.subscription_plan ?? null,
        profile.subscription_interval ?? null
      ),
      subscriptionExpiresAt: profile.subscription_expires_at ?? null,
      pendingRequests,
    };
  });

  return rows.sort((a, b) => {
    const aPending = a.pendingRequests.length > 0 ? 1 : 0;
    const bPending = b.pendingRequests.length > 0 ? 1 : 0;
    if (bPending !== aPending) return bPending - aPending;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function getAdminDashboardStats() {
  const admin = createAdminClient();

  const [clients, awaitingRequests, revenue30d, revenueAll] = await Promise.all([
    getAdminClientsWithSubscriptions(),
    admin
      .from("plan_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_approval"),
    getAdminRevenue("30d"),
    getAdminRevenue("all"),
  ]);

  return {
    clientCount: clients.length,
    activeSubscribers: clients.filter((c) => c.activeSubscription).length,
    awaitingApproval: awaitingRequests.count ?? 0,
    revenue30d,
    revenueAll,
  };
}
