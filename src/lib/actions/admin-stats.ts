import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import {
  freeTrialDaysRemaining,
  hasPaidAccess,
  isOnFreeTrial,
  subscriptionLabel,
} from "@/lib/subscription";

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
  onFreeTrial: boolean;
  trialDaysLeft: number | null;
  subscriptionLabel: string;
  subscriptionExpiresAt: string | null;
}

export async function getAdminClientsWithSubscriptions(): Promise<AdminClientRow[]> {
  const admin = createAdminClient();
  const [{ data: clientsResult }, emailById] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    fetchAuthEmailMap(admin),
  ]);

  return (clientsResult ?? []).map((client) => {
    const profile = client as Profile;
    const onTrial = isOnFreeTrial(profile);
    const trialDaysLeft = onTrial ? freeTrialDaysRemaining(profile) : null;
    return {
      ...profile,
      email: emailById[profile.id],
      activeSubscription: hasPaidAccess(profile),
      onFreeTrial: onTrial,
      trialDaysLeft,
      subscriptionLabel: subscriptionLabel(
        profile.subscription_plan ?? null,
        profile.subscription_interval ?? null,
        onTrial ? { trial: true, trialDaysLeft } : undefined
      ),
      subscriptionExpiresAt: profile.subscription_expires_at ?? null,
    };
  });
}

async function fetchAuthEmailMap(
  admin: ReturnType<typeof createAdminClient>
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let page = 1;

  while (page < 50) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) break;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.email) map[user.id] = user.email;
    }
    if (users.length < 200) break;
    page += 1;
  }

  return map;
}

export async function getAdminDashboardStats() {
  const [clients, revenue30d, revenueAll] = await Promise.all([
    getAdminClientsWithSubscriptions(),
    getAdminRevenue("30d"),
    getAdminRevenue("all"),
  ]);

  const freeTrialCount = clients.filter((c) => c.onFreeTrial).length;
  const paidSubscribers = clients.filter(
    (c) => c.activeSubscription && !c.onFreeTrial
  ).length;
  const noSubscriptionCount = clients.filter((c) => !c.activeSubscription).length;

  return {
    clientCount: clients.length,
    activeSubscribers: clients.filter((c) => c.activeSubscription).length,
    paidSubscribers,
    freeTrialCount,
    noSubscriptionCount,
    revenue30d,
    revenueAll,
  };
}
