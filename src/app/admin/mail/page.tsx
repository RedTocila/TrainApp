import { requireAdmin } from "@/lib/actions/auth";
import { listMailClientsForPicker } from "@/lib/actions/admin-mail";
import { AdminMailComposer } from "@/components/admin-mail-composer";
import { PageTransition } from "@/components/page-transition";

export default async function AdminMailPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireAdmin();
  const { clientId } = await searchParams;
  const clients = await listMailClientsForPicker();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Mail</h1>
          <p className="text-muted-foreground">
            Email clients about subscriptions, updates, or feedback. Start with
            people who haven&apos;t subscribed yet.
          </p>
        </div>
        <AdminMailComposer
          clients={clients}
          initialClientId={clientId ?? null}
        />
      </div>
    </PageTransition>
  );
}
