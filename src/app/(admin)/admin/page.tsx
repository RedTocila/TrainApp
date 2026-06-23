import { requireAdmin } from "@/lib/actions/auth";
import { getPendingRequests } from "@/lib/actions/requests";
import { getAllClients } from "@/lib/actions/plans";
import { getNotifications } from "@/lib/actions/notifications";
import { PlanRequestCard } from "@/components/plan-request-card";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, Bell } from "lucide-react";

export default async function AdminDashboardPage() {
  const profile = await requireAdmin();
  const [requests, clients, notifications] = await Promise.all([
    getPendingRequests(),
    getAllClients(),
    getNotifications(profile.id),
  ]);

  const unreadNotifs = notifications.filter((n) => !n.read).slice(0, 5);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-black">Coach Dashboard</h1>
          <p className="text-muted-foreground">Manage clients and build plans</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{clients.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Requests
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
                Unread Notifications
              </CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unreadNotifs.length}</p>
            </CardContent>
          </Card>
        </div>

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
                {requests.slice(0, 5).map((req) => (
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
