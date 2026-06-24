"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { getNutritionPlanPdfSignedUrl } from "@/lib/actions/nutrition-plan-pdf";

export function NutritionPlanPdfViewer({
  requestId,
  className,
}: {
  requestId: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getNutritionPlanPdfSignedUrl(requestId).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(result.error);
        setUrl(null);
      } else if ("url" in result) {
        setUrl(result.url);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your plan…
      </div>
    );
  }

  if (error || !url) {
    return (
      <p className={`text-sm text-red-400 ${className ?? ""}`}>
        {error ?? "Could not load PDF"}
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-medium">Your nutrition plan</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open
        </a>
      </div>
      <iframe
        title="Nutrition plan PDF"
        src={url}
        className="h-[min(60vh,28rem)] w-full rounded-xl border border-border bg-white"
      />
    </div>
  );
}
