import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardMobileHeader } from "@/components/dashboard-mobile-header";
import { LocaleProvider } from "@/components/locale-provider";
import { PendingIntakeSync } from "@/components/pending-intake-sync";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { DateProvider } from "@/components/date-provider";
import { DashboardSyncProvider } from "@/components/dashboard-sync";
import { FullCalendarProvider } from "@/components/full-calendar-provider";
import { DashboardMainReset } from "@/components/dashboard-main-reset";
import {
  DashboardNavPendingContent,
  DashboardNavPendingProvider,
} from "@/components/dashboard-nav-pending";
import { TrainSectionShell } from "@/components/train-section-shell";
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
        <DashboardSyncProvider>
        <DashboardNavPendingProvider>
        <div className="dashboard-shell flex min-h-0 overflow-hidden bg-background">
          <ClientNav fullName={profile.full_name} />
          <FullCalendarProvider>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <DashboardMobileHeader />
              <main
                className="dashboard-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] pt-[var(--dashboard-mobile-header-height)] [-webkit-overflow-scrolling:touch] lg:px-0 lg:pb-0 lg:pt-0"
              >
              <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
                <SubscriptionBanner profile={profile} />
                <DashboardNavPendingContent>
                  <TrainSectionShell>{children}</TrainSectionShell>
                </DashboardNavPendingContent>
              </div>
              </main>
            </div>
          </FullCalendarProvider>
        </div>
        </DashboardNavPendingProvider>
        </DashboardSyncProvider>
      </DateProvider>
    </LocaleProvider>
  );
}
