import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardAiCoachProvider } from "@/components/dashboard-ai-coach-provider";
import { DashboardMainArea } from "@/components/dashboard-main-area";
import { LocaleProvider } from "@/components/locale-provider";
import { PendingIntakeSync } from "@/components/pending-intake-sync";
import { SubscriptionBanner } from "@/components/subscription-banner";
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
    <LocaleProvider locale={locale}>
      <PendingIntakeSync intakeComplete={intakeComplete} />
      <DashboardMainReset />
      <DateProvider>
        <DashboardDayRollover />
        <DashboardSyncProvider>
        <DashboardDateLoadingProvider>
        <DashboardNavPendingProvider>
        <div className="dashboard-shell flex min-h-0 overflow-hidden bg-background">
          <ClientNav fullName={profile.full_name} />
          <DashboardAiCoachProvider>
          <FullCalendarProvider>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <main
                className="dashboard-main dashboard-texture min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] [-webkit-overflow-scrolling:touch] lg:pb-0"
              >
              <DashboardMainArea
                subscriptionBanner={<SubscriptionBanner profile={profile} />}
              >
                {children}
              </DashboardMainArea>
              </main>
            </div>
          </FullCalendarProvider>
          </DashboardAiCoachProvider>
        </div>
        </DashboardNavPendingProvider>
        </DashboardDateLoadingProvider>
        </DashboardSyncProvider>
      </DateProvider>
    </LocaleProvider>
  );
}
