import Link from "next/link";
import { Camera, LineChart, Salad, Sparkles, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { getDashboardAiInsight, getLatestWeeklyReport } from "@/lib/actions/ai-coach";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/utils";

const quickLinks = [
  {
    href: "/dashboard/ai/meal-suggestions",
    label: "Meal suggestions",
    description: "Meals that fit your remaining macros",
    icon: Salad,
  },
  {
    href: "/dashboard/ai/recommendations",
    label: "Recommendations",
    description: "Habit patterns and coaching tips",
    icon: Sparkles,
  },
  {
    href: "/dashboard/ai/predictions",
    label: "Progress predictions",
    description: "Goal timeline and weight projection",
    icon: LineChart,
  },
  {
    href: "/dashboard/ai/reports",
    label: "Weekly reports",
    description: "Training, nutrition & consistency scores",
    icon: FileText,
  },
];

export default async function AiCoachOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;

  const aiAccess = hasAiAccess(profile);
  const today = formatDateKey(new Date());
  const [insight, report] = aiAccess
    ? await Promise.all([getDashboardAiInsight(today), getLatestWeeklyReport()])
    : [null, null];

  if (!aiAccess) {
    return <AiUpgradeGate />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s insight</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {insight && "message" in insight ? insight.message : "Log meals to get personalized guidance."}
          </p>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest weekly report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{report.summary}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2 py-1">
                Training {report.training_score}/100
              </span>
              <span className="rounded-full bg-secondary px-2 py-1">
                Nutrition {report.nutrition_score}/100
              </span>
              <span className="rounded-full bg-secondary px-2 py-1">
                Consistency {report.consistency_score}/100
              </span>
            </div>
            <Link href="/dashboard/ai/reports" className="text-sm font-medium text-primary hover:underline">
              View full report
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Log with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            On the dashboard, tap <strong className="text-foreground">Log meal</strong> → choose{" "}
            <strong className="text-foreground">Photo</strong> or{" "}
            <strong className="text-foreground">Type it</strong>. Review macros, edit if needed,
            then confirm to save.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardContent className="flex gap-3 p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
