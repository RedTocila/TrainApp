"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildPricingHref } from "@/lib/pricing-nav";

export function AiInsightCard({
  message,
  hasAiAccess,
  proteinGap,
}: {
  message?: string;
  hasAiAccess: boolean;
  proteinGap?: number;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const pathname = usePathname();
  if (!hasAiAccess) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{platform.ai.aiCoach}</p>
              <p className="text-sm text-muted-foreground">{coachLabels.coachHasOpinions}</p>
            </div>
          </div>
          <Link href={buildPricingHref(pathname)}>
            <Button size="sm" variant="outline">
              {platform.ai.upgrade}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/10 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {platform.ai.aiInsight}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{message ?? coachLabels.coachHasNotes}</p>
        {proteinGap != null && proteinGap > 15 && (
          <p className="text-xs text-amber-400">
            {platform.ai.proteinGap(Math.round(proteinGap))}
          </p>
        )}
        <Link
          href="/dashboard/ai"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          {coachLabels.faceTheRoast}
          <ChevronRight className="ml-0.5 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
