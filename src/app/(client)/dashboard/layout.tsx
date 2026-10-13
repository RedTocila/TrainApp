import { requireClient } from "@/lib/actions/auth";
import { ClientNav } from "@/components/client-nav";
import { DashboardAiCoachProvider } from "@/components/dashboard-ai-coach-provider";
import { DashboardMainArea } from "@/components/dashboard-main-area";
import { LocaleProvider } from "@/components/locale-provider";
import { PendingIntakeSync } from "@/components/pending-intake-sync";
import { StarterWorkoutGate } from "@/components/starter-workout-gate";
import { createClient } from "@/lib/supabase/server";
import { NativeAppAccessSync } from "@/components/ios/native-app-access-sync";
import { ReminderBootstrap } from "@/components/reminder-bootstrap";
import { DateProvider } from "@/components/date-provider";
import { DashboardSyncProvider } from "@/components/dashboard-sync";
import { FullCalendarProvider } from "@/components/full-calendar-provider";
import { DashboardMainReset } from "@/components/dashboard-main-reset";
import { DashboardDayRollover } from "@/components/dashboard-day-rollover";
import { DashboardDateLoadingProvider } from "@/components/dashboard-date-loading";
import { DashboardNavPendingProvider } from "@/components/dashboard-nav-pending";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";

export const maxDuration = 60;

async function needsStarterWorkout(clientId: string, intakeComplete: boolean) {
  if (!intakeComplete) return false;
  try {
    const supabase = await createClient();
    const [{ data: assignment, error: assignmentError }, { data: personal, error: personalError }] =
      await Promise.all([
        supabase
          .from("workout_assignments")
          .select("id")
          .eq("client_id", clientId)
          .eq("active", true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("workout_plans")
          .select("id")
          .eq("created_by", clientId)
          .eq("is_personal", true)
          .limit(1)
          .maybeSingle(),
      ]);
    if (assignmentError || personalError) return false;
    return !assignment && !personal;
  } catch {
    return false;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireClient();
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const intakeComplete = isClientIntakeComplete(profile);
  const showStarterWorkout = await needsStarterWorkout(profile.id, intakeComplete);

  return (
    <LocaleProvider locale={locale}>
      <PendingIntakeSync intakeComplete={intakeComplete} />
      {showStarterWorkout ? <StarterWorkoutGate /> : null}
      <NativeAppAccessSync />
      <ReminderBootstrap />
      <DashboardMainReset />
      <DateProvider>
        <DashboardDayRollover />
        <DashboardSyncProvider>
        <DashboardDateLoadingProvider>
        <DashboardNavPendingProvider>
        <FullCalendarProvider>
        <DashboardAiCoachProvider>
        <div className="dashboard-shell flex min-h-0 overflow-visible bg-background lg:overflow-hidden">
          <ClientNav fullName={profile.full_name} />
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <main
                className="dashboard-main scroll-smooth min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-visible bg-background px-0 pb-[var(--dashboard-mobile-nav-height,4.25rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pb-0 lg:[-webkit-overflow-scrolling:touch]"
              >
              <DashboardMainArea>
                {children}
              </DashboardMainArea>
              </main>
            </div>
        </div>
        </DashboardAiCoachProvider>
        </FullCalendarProvider>
        </DashboardNavPendingProvider>
        </DashboardDateLoadingProvider>
        </DashboardSyncProvider>
      </DateProvider>
    </LocaleProvider>
  );
}
