import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getAdminClientCalendarData } from "@/lib/actions/admin-client-calendar";
import { getAdminClientProgressPhotoGallery } from "@/lib/actions/admin-progress-photos";
import { getClientIntakeInfo } from "@/lib/actions/client-intake";
import { AdminClientProgressPhotos } from "@/components/admin-client-progress-photos";
import { AdminClientHealthProfile } from "@/components/admin-client-health-profile";
import { DeleteClientAccountButton } from "@/components/delete-client-account-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { AdminClientCalendar } from "@/components/admin-client-calendar";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [calendarData, progressPhotos, authUser, intake] = await Promise.all([
    getAdminClientCalendarData(id),
    getAdminClientProgressPhotoGallery(id),
    createAdminClient().auth.admin.getUserById(id),
    getClientIntakeInfo(id),
  ]);
  const email = authUser.data.user?.email ?? null;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Link href="/admin/clients">
              <Button variant="ghost" size="sm" className="-ml-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Clients
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-black break-words">{client.full_name}</h1>
              <p className="text-muted-foreground">Days report</p>
              {(email || client.phone) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {email ? (
                    <Link
                      href={`/admin/mail?clientId=${id}`}
                      className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{email}</span>
                    </Link>
                  ) : null}
                  {client.phone ? (
                    <a
                      href={`sms:${client.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {client.phone}
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <DeleteClientAccountButton
            clientId={client.id}
            clientName={client.full_name}
            size="icon"
            variant="destructive"
            className="shrink-0"
          />
        </div>

        {calendarData && (
          <AdminClientCalendar
            schedule={calendarData.schedule}
            enrichment={calendarData.enrichment}
          />
        )}

        <AdminClientProgressPhotos months={progressPhotos} />

        <AdminClientHealthProfile intake={intake} />
      </div>
    </PageTransition>
  );
}
