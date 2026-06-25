import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardMobileHeader } from "@/components/dashboard-mobile-header";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { DateProvider } from "@/components/date-provider";
import { DashboardSyncProvider } from "@/components/dashboard-sync";
import { FullCalendarProvider } from "@/components/full-calendar-provider";
import { TrainSectionShell } from "@/components/train-section-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();

  return (
    <DateProvider>
      <DashboardSyncProvider>
      <FullCalendarProvider>
        <div className="dashboard-shell flex min-h-0 overflow-hidden">
          <ClientNav fullName={profile.full_name} />
          <main className="dashboard-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] pt-0 [-webkit-overflow-scrolling:touch] lg:px-0 lg:pb-0">
            <DashboardMobileHeader />
            <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
              <SubscriptionBanner profile={profile} />
              <TrainSectionShell>{children}</TrainSectionShell>
            </div>
          </main>
        </div>
      </FullCalendarProvider>
      </DashboardSyncProvider>
    </DateProvider>
  );
}
