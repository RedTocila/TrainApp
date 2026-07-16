import { Suspense } from "react";
import { requireAdmin } from "@/lib/actions/auth";
import {
  getAdminDashboardStats,
  getAdminRevenue,
  type RevenuePeriod,
} from "@/lib/actions/admin-stats";
import { getNotifications } from "@/lib/actions/notifications";
import { AdminRevenuePanel } from "@/components/admin-revenue-panel";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Bell, Euro } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const VALID_PERIODS: RevenuePeriod[] = ["1d", "7d", "30d", "90d", "all"];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await requireAdmin();
  const { period: periodParam } = await searchParams;
  const period: RevenuePeriod = VALID_PERIODS.includes(periodParam as RevenuePeriod)
    ? (periodParam as RevenuePeriod)
    : "30d";

  const [stats, revenue, notifications] = await Promise.all([
    getAdminDashboardStats(),
    getAdminRevenue(period),
    getNotifications(profile.id),
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black sm:text-3xl">Coach Dashboard</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage clients, revenue, and content
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/admin/clients" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                All clients
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.clientCount}</p>
              <p className="text-xs text-muted-foreground">
                {stats.activeSubscribers} active subscribers
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unread notifications
              </CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">
                Open the bell in the header to read them
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Revenue</h2>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <AdminRevenuePanel revenue={revenue} />
          </Suspense>
        </section>
      </div>
    </PageTransition>
  );
}
