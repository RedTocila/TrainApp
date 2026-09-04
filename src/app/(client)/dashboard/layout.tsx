import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardAiCoachProvider } from "@/components/dashboard-ai-coach-provider";
import { DashboardMainArea } from "@/components/dashboard-main-area";
import { LocaleProvider } from "@/components/locale-provider";
import { PendingIntakeSync } from "@/components/pending-intake-sync";
import { DateProvider } from "@/components/date-provider";
import { DashboardSyncProvider } from "@/components/dashboard-sync";
import { FullCalendarProvider } from "@/components/full-calendar-provider";
import { DashboardMainReset } from "@/components/dashboard-main-reset";
import { DashboardDayRollover } from "@/components/dashboard-day-rollover";
import { DashboardDateLoadingProvider } from "@/components/dashboard-date-loading";
import { DashboardNavPendingProvider } from "@/components/dashboard-nav-pending";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const intakeComplete = isClientIntakeComplete(profile);

  return (
    <LocaleProvider locale={locale} unitSystem={profile.unit_system ?? "metric"}>
      <PendingIntakeSync intakeComplete={intakeComplete} />
      <DashboardMainReset />
      <DateProvider>
        <DashboardDayRollover />
        <DashboardSyncProvider>
        <DashboardDateLoadingProvider>
        <DashboardNavPendingProvider>
        <DashboardAiCoachProvider>
        <div className="dashboard-shell flex min-h-0 overflow-visible bg-background lg:overflow-hidden">
          <ClientNav fullName={profile.full_name} />
          <FullCalendarProvider>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <main
                className="dashboard-main scroll-smooth min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-visible bg-background px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pb-0 lg:[-webkit-overflow-scrolling:touch]"
              >
              <DashboardMainArea>
                {children}
              </DashboardMainArea>
              </main>
            </div>
          </FullCalendarProvider>
        </div>
        </DashboardAiCoachProvider>
        </DashboardNavPendingProvider>
        </DashboardDateLoadingProvider>
        </DashboardSyncProvider>
      </DateProvider>
    </LocaleProvider>
  );
}
