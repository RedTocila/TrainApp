"use client";

import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AiInsightCard({
  message,
  hasAiAccess,
  proteinGap,
}: {
  message?: string;
  hasAiAccess: boolean;
  proteinGap?: number;
}) {
  if (!hasAiAccess) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">AI Coach</p>
              <p className="text-sm text-muted-foreground">
                Subscribe to Core for AI Coach insights, or upgrade to AI for plan builders and
                photo meal logging.
              </p>
            </div>
          </div>
          <Link href="/dashboard/pricing">
            <Button size="sm" variant="outline">
              Upgrade
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
          AI Insight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{message ?? "Check AI Coach for personalized guidance."}</p>
        {proteinGap != null && proteinGap > 15 && (
          <p className="text-xs text-amber-400">
            Protein gap today: ~{Math.round(proteinGap)}g remaining
          </p>
        )}
        <Link
          href="/dashboard/ai"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          Open AI Coach
          <ChevronRight className="ml-0.5 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
