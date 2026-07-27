import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getLatestWeeklyReport } from "@/lib/actions/ai-coach";
import { buildPricingHref } from "@/lib/pricing-nav";
import { redirect } from "next/navigation";
import { WeeklyReportClient } from "@/components/weekly-report-client";

export default async function AiReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !hasAiAccess(profile)) {
    redirect(buildPricingHref("/dashboard/ai/reports"));
  }

  const report = await getLatestWeeklyReport();

  return <WeeklyReportClient initialReport={report} />;
}
