"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, HeartPulse, Pencil, Sparkles } from "lucide-react";
import { IntakeQuestionnaireWizard } from "@/components/intake-questionnaire-wizard";
import { updateClientIntakeFromResponses } from "@/lib/actions/client-intake";
import {
  getMissingIntakeResponses,
  isIntakeResponsesComplete,
  profileToResponses,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { buildFullIntakeSummary } from "@/lib/intake-display";
import { useBodyUnits, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSectionHeader } from "@/components/dashboard-ui";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type PanelMode = "closed" | "view" | "update";

export function ClientIntakeForm({ profile }: { profile: Profile }) {
  const platform = usePlatformCopy();
  const { unitSystem } = useBodyUnits();
  const initial = profileToResponses(profile);
  const complete = isIntakeResponsesComplete(initial);
  const missingFields = getMissingIntakeResponses(initial);
  const [mode, setMode] = useState<PanelMode>(complete ? "closed" : "update");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [macroMessage, setMacroMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!complete) setMode("update");
  }, [complete]);

  const summary = buildFullIntakeSummary(profile, unitSystem);

  const handleComplete = (responses: IntakeResponses) => {
    setError(null);
    setSuccess(false);
    setMacroMessage(null);
    startTransition(async () => {
      const result = await updateClientIntakeFromResponses(responses);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setMode("view");
      if (result.macrosUpdated && result.macros) {
        const prefix =
          result.macroSource === "ai" ? "AI-personalized targets" : "Estimated targets";
        const rationale =
          result.macroRationale && result.macroSource === "ai"
            ? ` — ${result.macroRationale}`
            : "";
        setMacroMessage(
          `${prefix}: ${result.macros.calories} cal · P${result.macros.protein} C${result.macros.carbs} F${result.macros.fat}${rationale}`
        );
      }
      router.refresh();
    });
  };

  const incompletePreview = missingFields.slice(0, 3).join(", ");
  const subtitle = complete
    ? platform.profile.healthLifestyleCompleteHint
    : platform.profile.healthLifestyleIncompleteHint(
        missingFields.length,
        incompletePreview + (missingFields.length > 3 ? "…" : "")
      );

  return (
    <DashboardThemedShell id="dashboard-health-lifestyle" theme="lifestyle" className="p-4">
      <DashboardSectionHeader
        icon={HeartPulse}
        iconClassName="text-rose-600 dark:text-rose-300"
        title={platform.profile.healthLifestyleTitle}
        badge={
          complete ? (
            <Badge className="bg-green-500/15 text-green-400">{platform.profile.complete}</Badge>
          ) : (
            <Badge className="bg-red-500/15 text-red-400">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {platform.profile.incomplete}
            </Badge>
          )
        }
        action={
          <Button
            type="button"
            size="sm"
            variant={mode === "update" ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => setMode((current) => (current === "update" ? "closed" : "update"))}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {platform.common.update}
          </Button>
        }
      />

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{subtitle}</p>
        <Button
          type="button"
          size="sm"
          variant={mode === "view" ? "default" : "outline"}
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          onClick={() => setMode((current) => (current === "view" ? "closed" : "view"))}
          disabled={!complete && summary.length === 0}
          aria-expanded={mode === "view"}
        >
          {platform.common.view}
          <ChevronDown
            className={cn(
              "ml-1.5 h-3.5 w-3.5 transition-transform",
              mode === "view" && "rotate-180"
            )}
          />
        </Button>
      </div>

      {mode === "view" && (
        <div className="mt-4 space-y-3">
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {platform.profile.healthLifestyleIncompleteHint(missingFields.length || 1, "…")}
            </p>
          ) : (
            <ul className="space-y-2 rounded-2xl border border-rose-500/20 bg-background/50 p-3">
              {summary.map((item) => (
                <li
                  key={`${item.label}-${item.value}`}
                  className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0 last:pb-0 first:pt-0"
                >
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                  <span className="max-w-[60%] text-right text-sm font-semibold">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
          {complete && (
            <p className="text-xs text-muted-foreground">
              {platform.profile.healthLifestyleLockedHint}
            </p>
          )}
        </div>
      )}

      {mode === "update" && (
        <div className="mt-4 space-y-4">
          <IntakeQuestionnaireWizard
            compact
            completeLabel="Save health profile"
            initialResponses={initial}
            onComplete={handleComplete}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">Saved</p>}
          {macroMessage && (
            <p className="flex items-start gap-1.5 text-sm text-green-400/90">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {macroMessage}
            </p>
          )}
          {isPending && (
            <p className="text-sm text-muted-foreground">{platform.common.saving}</p>
          )}
        </div>
      )}
    </DashboardThemedShell>
  );
}
