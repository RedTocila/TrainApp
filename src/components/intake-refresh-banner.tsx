"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Sparkles, X } from "lucide-react";
import { DASHBOARD_NAV_GLASS_CLASS } from "@/components/ai-coach-fab";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getIntakeLastUpdatedAt,
  shouldShowIntakeRefreshBanner,
  writeIntakeRefreshDismiss,
} from "@/lib/client-intake-utils";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_LIFESTYLE_HASH = "dashboard-health-lifestyle";

export function IntakeRefreshBanner({ profile }: { profile: Profile }) {
  const platform = usePlatformCopy();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowIntakeRefreshBanner(profile));
  }, [profile]);

  if (!visible) return null;

  const scrollToForm = () => {
    const el = document.getElementById(HEALTH_LIFESTYLE_HASH);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.dispatchEvent(
        new CustomEvent("intake-refresh-open", { detail: { mode: "update" } })
      );
    } else {
      window.location.hash = HEALTH_LIFESTYLE_HASH;
      window.dispatchEvent(
        new CustomEvent("intake-refresh-open", { detail: { mode: "update" } })
      );
    }
  };

  const dismiss = () => {
    writeIntakeRefreshDismiss(profile.id, getIntakeLastUpdatedAt(profile));
    setVisible(false);
  };

  return (
    <Card className="border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent">
      <CardContent className="relative flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={platform.common.close}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex min-w-0 items-start gap-2.5 pr-6">
          <div className="shrink-0 rounded-md bg-sky-500/15 p-1.5">
            <ClipboardList className="h-4 w-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">
              {platform.profile.intakeRefreshTitle}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {platform.profile.intakeRefreshBody}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            DASHBOARD_NAV_GLASS_CLASS,
            "w-full shrink-0 text-foreground sm:w-auto sm:self-center [@media(hover:hover)]:hover:bg-white/95 dark:[@media(hover:hover)]:hover:bg-background/45"
          )}
          onClick={scrollToForm}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5 text-sky-400" />
          {platform.profile.intakeRefreshCta}
        </Button>
      </CardContent>
    </Card>
  );
}
