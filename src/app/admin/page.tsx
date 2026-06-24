import { Suspense } from "react";
import { requireAdmin } from "@/lib/actions/auth";
import { getPendingRequests } from "@/lib/actions/requests";
import {
  getAdminClientsWithSubscriptions,
  getAdminDashboardStats,
  getAdminRevenue,
  type RevenuePeriod,
} from "@/lib/actions/admin-stats";
import { getRecentClientActivity } from "@/lib/actions/client-activity";
import { getNotifications } from "@/lib/actions/notifications";
import { PlanRequestCard } from "@/components/plan-request-card";
import { AdminRevenuePanel } from "@/components/admin-revenue-panel";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, Bell, Euro } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientActivityFeed } from "@/components/client-activity-feed";

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

  const [requests, stats, revenue, notifications, recentActivity] = await Promise.all([
    getPendingRequests(),
    getAdminDashboardStats(),
    getAdminRevenue(period),
    getNotifications(profile.id),
    getRecentClientActivity(20),
  ]);

  const unreadNotifs = notifications.filter((n) => !n.read).slice(0, 5);
  const awaitingApproval = requests.filter((r) => r.status === "awaiting_approval");

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black sm:text-3xl">Coach Dashboard</h1>
            <p className="text-muted-foreground">Manage clients, revenue, and custom plans</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/admin/clients">
              <Button variant="outline" size="sm">All clients</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
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
                Awaiting approval
              </CardTitle>
              <Dumbbell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.awaitingApproval}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open requests
              </CardTitle>
              <Dumbbell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{requests.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Notifications
              </CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unreadNotifs.length}</p>
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

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Recent client activity</h2>
            <Link href="/admin/clients">
              <Button variant="outline" size="sm">
                All clients
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              <ClientActivityFeed
                items={recentActivity}
                showClientName
                emptyMessage="No client activity yet"
              />
            </CardContent>
          </Card>
        </section>

        {awaitingApproval.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Paid proposals to review</h2>
            <StaggerContainer>
              <div className="space-y-3">
                {awaitingApproval.map((req) => (
                  <StaggerItem key={req.id}>
                    <PlanRequestCard request={req} />
                  </StaggerItem>
                ))}
              </div>
            </StaggerContainer>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Recent Requests</h2>
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending requests
              </CardContent>
            </Card>
          ) : (
            <StaggerContainer>
              <div className="space-y-3">
                {requests.slice(0, 8).map((req) => (
                  <StaggerItem key={req.id}>
                    <PlanRequestCard request={req} />
                  </StaggerItem>
                ))}
              </div>
            </StaggerContainer>
          )}
        </section>

        {unreadNotifs.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Recent Notifications</h2>
            <div className="space-y-2">
              {unreadNotifs.map((n) => (
                <Card key={n.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.body}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
