import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardMobileHeader } from "@/components/dashboard-mobile-header";
import { DateProvider } from "@/components/date-provider";
import { FullCalendarProvider } from "@/components/full-calendar-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();

  return (
    <DateProvider>
      <FullCalendarProvider>
        <div className="dashboard-shell flex h-dvh min-h-0 overflow-hidden">
          <ClientNav fullName={profile.full_name} />
          <main className="dashboard-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-20 [-webkit-overflow-scrolling:touch] lg:pb-0">
            <DashboardMobileHeader />
            <div className="p-4 md:p-6">{children}</div>
          </main>
        </div>
      </FullCalendarProvider>
    </DateProvider>
  );
}
