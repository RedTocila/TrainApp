import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllClients } from "@/lib/actions/plans";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await getAllClients();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Clients</h1>
          <p className="text-muted-foreground">All registered clients</p>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No clients yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <Card key={client.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{client.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Joined {format(new Date(client.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Link href={`/admin/clients/${client.id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
