import { requireClient } from "@/lib/actions/auth";
import { getPublishedChallenges } from "@/lib/actions/challenges";
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
import { DashboardPullToRefresh } from "@/components/dashboard-pull-to-refresh";
import { DashboardDateLoadingProvider } from "@/components/dashboard-date-loading";
import { DashboardNavPendingProvider } from "@/components/dashboard-nav-pending";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { hasLiveChallenge } from "@/lib/challenge-utils";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const intakeComplete = isClientIntakeComplete(profile);
  const challenges = await getPublishedChallenges(profile.gender);
  const liveChallengeActive = hasLiveChallenge(challenges);

  return (
    <LocaleProvider locale={locale} unitSystem={profile.unit_system ?? "metric"}>
      <PendingIntakeSync intakeComplete={intakeComplete} />
      <DashboardMainReset />
      <DateProvider>
        <DashboardDayRollover />
        <DashboardPullToRefresh />
        <DashboardSyncProvider>
        <DashboardDateLoadingProvider>
        <DashboardNavPendingProvider>
        <div className="dashboard-shell flex min-h-0 overflow-hidden bg-background">
          <ClientNav fullName={profile.full_name} liveChallengeActive={liveChallengeActive} />
          <DashboardAiCoachProvider>
          <FullCalendarProvider>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <main
                className="dashboard-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] [-webkit-overflow-scrolling:touch] lg:pb-0"
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
