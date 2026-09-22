"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Dumbbell,
  HeartPulse,
  Loader2,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  IntakeQuestionnaireWizard,
  MacroDonut,
} from "@/components/intake-questionnaire-wizard";
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
import type { MacroTargets } from "@/lib/macro-calculator";
import type { Profile } from "@/lib/types";

type PanelMode = "closed" | "view" | "update";

type MacroResult = {
  macros: MacroTargets;
  source: "ai" | "formula";
  rationale?: string;
};

type WorkoutResult =
  | {
      status: "ready";
      title: string;
      daysPerWeek: number;
      sessions: number;
    }
  | { status: "failed" };

function IntakeSavingPanel({
  buildingProgram,
}: {
  buildingProgram: boolean;
}) {
  const platform = usePlatformCopy();
  const steps = buildingProgram
    ? [
        platform.profile.personalizingProfile,
        platform.profile.calculatingMacros,
        platform.profile.buildingWorkoutProgram,
      ]
    : [platform.common.saving, platform.profile.calculatingMacros];

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, 2200);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-white/15 bg-black/30 px-5 py-10 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/20" />
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
          <Loader2 className="h-7 w-7 animate-spin" />
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-tight">
          {steps[stepIndex] ?? platform.common.saving}
        </p>
        <p className="text-xs text-muted-foreground">
          {platform.profile.savingTakeAMoment}
        </p>
      </div>
      <div className="flex gap-1.5 pt-1">
        {steps.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i <= stepIndex ? "bg-rose-400" : "bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function MacroResultCard({ result }: { result: MacroResult }) {
  const platform = usePlatformCopy();
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
          {platform.profile.dailyTargetsTitle}
        </p>
        <Badge className="bg-emerald-500/20 text-emerald-300">
          <Sparkles className="mr-1 h-3 w-3" />
          {result.source === "ai"
            ? platform.profile.aiPersonalizedTargets
            : platform.profile.estimatedTargets}
        </Badge>
      </div>
      <MacroDonut macros={result.macros} />
      {result.rationale && result.source === "ai" && (
        <p className="mt-3 line-clamp-2 text-center text-xs leading-relaxed text-muted-foreground">
          {result.rationale}
        </p>
      )}
    </div>
  );
}

function WorkoutResultCard({ result }: { result: WorkoutResult }) {
  const platform = usePlatformCopy();
  if (result.status === "failed") {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-100/90">
        {platform.profile.workoutProgramFailed}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
        <Dumbbell className="h-4 w-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-sky-100">
          {platform.profile.workoutReadyTitle}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {platform.profile.workoutReadyDetail(
            result.title,
            result.daysPerWeek,
            result.sessions
          )}
        </p>
      </div>
    </div>
  );
}

function SavedResults({
  macroResult,
  workoutResult,
}: {
  macroResult: MacroResult | null;
  workoutResult: WorkoutResult | null;
}) {
  if (!macroResult && !workoutResult) return null;
  return (
    <div className="space-y-3">
      {macroResult && <MacroResultCard result={macroResult} />}
      {workoutResult && <WorkoutResultCard result={workoutResult} />}
    </div>
  );
}

export function ClientIntakeForm({ profile }: { profile: Profile }) {
  const platform = usePlatformCopy();
  const { unitSystem } = useBodyUnits();
  const initial = profileToResponses(profile);
  const complete = isIntakeResponsesComplete(initial);
  const missingFields = getMissingIntakeResponses(initial);
  const [mode, setMode] = useState<PanelMode>(complete ? "closed" : "update");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  const [workoutResult, setWorkoutResult] = useState<WorkoutResult | null>(null);
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
    setMacroResult(null);
    setWorkoutResult(null);
    const firstCompletion = !complete;
    setBuildingProgram(firstCompletion);
    startTransition(async () => {
      try {
        const result = await updateClientIntakeFromResponses(responses);
        setBuildingProgram(false);
        if (result?.error) {
          setError(platform.profile.saveFailed);
          return;
        }
        const { clearIntakeRefreshDismiss } = await import(
          "@/lib/client-intake-utils"
        );
        clearIntakeRefreshDismiss(profile.id);
        setSuccess(true);
        setMode("view");
        if (result.macrosUpdated && result.macros) {
          setMacroResult({
            macros: result.macros,
            source: result.macroSource === "ai" ? "ai" : "formula",
            rationale: result.macroRationale,
          });
        }
        if (result.workoutProgram?.built) {
          setWorkoutResult({
            status: "ready",
            title: result.workoutProgram.title,
            daysPerWeek: result.workoutProgram.daysPerWeek,
            sessions: result.workoutProgram.sessionsScheduled,
          });
        } else if (
          firstCompletion &&
          result.workoutProgram &&
          !result.workoutProgram.built &&
          !("skipped" in result.workoutProgram && result.workoutProgram.skipped)
        ) {
          setWorkoutResult({ status: "failed" });
        }
        router.refresh();
      } catch {
        setBuildingProgram(false);
        setError(platform.profile.saveFailed);
      }
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
            disabled={isPending}
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
          <div className="mt-3 space-y-3">
            {(macroResult || workoutResult) && (
              <SavedResults macroResult={macroResult} workoutResult={workoutResult} />
            )}

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
          </div>
        )}

        {mode === "update" && (
          <div className="mt-3 space-y-3">
            {isPending ? (
              <IntakeSavingPanel buildingProgram={buildingProgram} />
            ) : (
              <>
                <IntakeQuestionnaireWizard
                  compact
                  completeLabel="Save health profile"
                  initialResponses={initial}
                  onComplete={handleComplete}
                />
                {error && (
                  <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="flex items-center gap-1.5 text-sm text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </p>
                )}
              </>
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
          disabled={(!complete && summary.length === 0) || isPending}
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
