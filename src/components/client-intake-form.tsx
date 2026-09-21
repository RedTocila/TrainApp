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
import { DashboardThemedShell, DASHBOARD_CARD_BACKGROUNDS } from "@/components/dashboard-themed-shell";
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
  const [workoutMessage, setWorkoutMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [buildingProgram, setBuildingProgram] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!complete) setMode("update");
  }, [complete]);

  useEffect(() => {
    const openUpdate = () => setMode("update");
    window.addEventListener("intake-refresh-open", openUpdate);
    if (window.location.hash === "#dashboard-health-lifestyle") {
      openUpdate();
    }
    return () => window.removeEventListener("intake-refresh-open", openUpdate);
  }, []);

  const summary = buildFullIntakeSummary(profile, unitSystem);

  const handleComplete = (responses: IntakeResponses) => {
    setError(null);
    setSuccess(false);
    setMacroMessage(null);
    setWorkoutMessage(null);
    const firstCompletion = !complete;
    setBuildingProgram(firstCompletion);
    startTransition(async () => {
      const result = await updateClientIntakeFromResponses(responses);
      setBuildingProgram(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const { clearIntakeRefreshDismiss } = await import(
        "@/lib/client-intake-utils"
      );
      clearIntakeRefreshDismiss(profile.id);
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
      if (result.workoutProgram?.built) {
        setWorkoutMessage(
          platform.profile.workoutProgramReady(
            result.workoutProgram.title,
            result.workoutProgram.daysPerWeek,
            result.workoutProgram.sessionsScheduled
          )
        );
      } else if (
        firstCompletion &&
        result.workoutProgram &&
        !result.workoutProgram.built &&
        !("skipped" in result.workoutProgram && result.workoutProgram.skipped)
      ) {
        setWorkoutMessage(platform.profile.workoutProgramFailed);
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
    <DashboardThemedShell
      id="dashboard-health-lifestyle"
      theme="lifestyle"
      backgroundSrc={DASHBOARD_CARD_BACKGROUNDS.lifestyle}
      backgroundAlt={platform.profile.healthLifestyleTitle}
      className="p-3.5"
    >
      <DashboardSectionHeader
        icon={HeartPulse}
        iconClassName="text-rose-300"
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
            className="!h-8 rounded-full px-3 text-xs"
            onClick={() => setMode((current) => (current === "update" ? "closed" : "update"))}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {platform.common.update}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col">
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

        {mode === "view" && (
          <div className="mt-3 space-y-2.5">
            {summary.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {platform.profile.healthLifestyleIncompleteHint(missingFields.length || 1, "…")}
              </p>
            ) : (
              <ul className="divide-y divide-white/10 rounded-2xl border border-white/15 bg-black/25 px-2.5">
                {summary.map((item) => (
                  <li
                    key={`${item.label}-${item.value}`}
                    className="grid grid-cols-[1.5rem_minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-x-2.5 py-2"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center self-center rounded-lg bg-rose-500/10 text-sm leading-none"
                      aria-hidden
                    >
                      {item.emoji ?? "•"}
                    </span>
                    <span className="self-center text-xs font-medium leading-none text-muted-foreground">
                      {item.label}
                    </span>
                    <span className="self-center text-right text-sm font-semibold leading-snug break-words">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {complete && (
              <p className="text-xs text-muted-foreground">
                {platform.profile.healthLifestyleLockedHint}
              </p>
            )}
            {macroMessage && (
              <p className="flex items-start gap-1.5 text-sm text-green-400/90">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {macroMessage}
              </p>
            )}
            {workoutMessage && (
              <p className="flex items-start gap-1.5 text-sm text-green-400/90">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {workoutMessage}
              </p>
            )}
          </div>
        )}

        {mode === "update" && (
          <div className="mt-3 space-y-3">
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
            {workoutMessage && (
              <p className="flex items-start gap-1.5 text-sm text-green-400/90">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {workoutMessage}
              </p>
            )}
            {isPending && (
              <p className="text-sm text-muted-foreground">
                {buildingProgram
                  ? platform.profile.buildingWorkoutProgram
                  : platform.common.saving}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end border-t border-border/50 pt-2.5">
        <Button
          type="button"
          size="sm"
          variant={mode === "view" ? "default" : "outline"}
          className="!h-8 shrink-0 rounded-full px-3 text-xs"
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
    </DashboardThemedShell>
  );
}
