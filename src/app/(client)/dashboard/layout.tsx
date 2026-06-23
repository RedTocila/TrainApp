import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DateProvider } from "@/components/date-provider";
import { DashboardCalendar } from "@/components/dashboard-calendar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();

  return (
    <DateProvider>
      <div className="flex min-h-screen">
        <ClientNav fullName={profile.full_name} />
        <div className="flex flex-1 flex-col pb-20 lg:pb-0">
          <DashboardCalendar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DateProvider>
  );
}
