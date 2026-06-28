"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useNutritionPageChromeActions } from "@/components/nutrition-page-chrome-context";
import { Button } from "@/components/ui/button";

export function DashboardDayDetailShell({
  children,
  backHref = "/dashboard",
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const platform = usePlatformCopy();
  const nutritionActions = useNutritionPageChromeActions();

  return (
    <div className="mx-auto max-w-3xl space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="-ml-2 h-9 gap-1.5 px-2">
            <ArrowLeft className="h-4 w-4" />
            {platform.common.back}
          </Button>
        </Link>
        {nutritionActions?.headerTrailing ?? null}
      </div>
      {children}
    </div>
  );
}
