"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Zap } from "lucide-react";
import { savePersonalHiitPlan } from "@/lib/actions/user-hiit";
import {
  DEFAULT_HIIT_CONFIG,
  estimateHiitDurationSeconds,
  formatHiitClock,
  hiitSummaryLabel,
  type HiitConfig,
  type HiitExerciseConfig,
} from "@/lib/hiit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function emptyExercise(): HiitExerciseConfig {
  return { name: "", work_seconds: 40, rest_seconds: 20 };
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 600,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Number.isFinite(next) ? next : min);
          }}
          className={cn(suffix && "pr-10")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HiitBuilder({
  planId: initialPlanId,
  initialTitle = "",
  initialDescription = "",
  initialConfig,
  wizard = false,
  onWizardComplete,
  stayOnPage = false,
  onSaved,
  folderId,
}: {
  planId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialConfig?: HiitConfig | null;
  wizard?: boolean;
  onWizardComplete?: (planId: string) => void;
  stayOnPage?: boolean;
  onSaved?: () => void;
  folderId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [showDescription, setShowDescription] = useState(!!initialDescription.trim());
  const [config, setConfig] = useState<HiitConfig>(
    initialConfig ?? {
      ...DEFAULT_HIIT_CONFIG,
      exercises: [emptyExercise(), emptyExercise(), emptyExercise()],
    }
  );

  const previewConfig: HiitConfig = {
    ...config,
    exercises: config.exercises.filter((e) => e.name.trim()),
  };
  const durationLabel =
    previewConfig.exercises.length > 0
      ? formatHiitClock(estimateHiitDurationSeconds(previewConfig))
      : "—";

  const updateExercise = (index: number, patch: Partial<HiitExerciseConfig>) => {
    setConfig((current) => ({
      ...current,
      exercises: current.exercises.map((ex, i) =>
        i === index ? { ...ex, ...patch } : ex
      ),
    }));
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await savePersonalHiitPlan({
        planId: initialPlanId,
        title,
        description,
        folderId,
        config,
        assign: !initialPlanId,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Could not save HIIT workout");
        return;
      }
      if (wizard && onWizardComplete) {
        onWizardComplete(result.data.id);
        return;
      }
      if (stayOnPage) {
        onSaved?.();
        return;
      }
      router.push("/dashboard/workout");
    });
  };

  return (
    <div className="space-y-6 pb-[calc(var(--dashboard-mobile-nav-height,4.25rem)+1rem)] lg:pb-0">
      <Card className="overflow-hidden border-orange-500/30">
        <div className="h-1.5 w-full bg-orange-500" aria-hidden />
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Zap className="h-5 w-5 text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle>HIIT program</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Build timed intervals. Estimate:{" "}
              <span className="font-semibold text-foreground">{durationLabel}</span>
              {previewConfig.exercises.length > 0
                ? ` · ${hiitSummaryLabel(previewConfig)}`
                : null}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full body HIIT"
            />
          </div>
          <div className="space-y-2">
            {showDescription ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="text-sm text-primary hover:underline"
              >
                Add description
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Structure</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Prepare"
            value={config.prepare_seconds}
            onChange={(prepare_seconds) =>
              setConfig((c) => ({ ...c, prepare_seconds }))
            }
            min={0}
            max={60}
            suffix="sec"
          />
          <NumberField
            label="Rounds"
            value={config.rounds}
            onChange={(rounds) => setConfig((c) => ({ ...c, rounds }))}
            min={1}
            max={50}
          />
          <NumberField
            label="Rest between rounds"
            value={config.round_rest_seconds}
            onChange={(round_rest_seconds) =>
              setConfig((c) => ({ ...c, round_rest_seconds }))
            }
            min={0}
            max={600}
            suffix="sec"
          />
          <NumberField
            label="Cycles"
            value={config.cycles}
            onChange={(cycles) => setConfig((c) => ({ ...c, cycles }))}
            min={1}
            max={20}
          />
          <NumberField
            label="Rest between cycles"
            value={config.cycle_rest_seconds}
            onChange={(cycle_rest_seconds) =>
              setConfig((c) => ({ ...c, cycle_rest_seconds }))
            }
            min={0}
            max={900}
            suffix="sec"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Exercises</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                exercises: [...c.exercises, emptyExercise()],
              }))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>

        {config.exercises.map((ex, index) => (
          <Card key={index} className="border-border/60">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-black text-orange-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <Input
                    value={ex.name}
                    onChange={(e) => updateExercise(index, { name: e.target.value })}
                    placeholder="Exercise name"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Work"
                      value={ex.work_seconds}
                      onChange={(work_seconds) =>
                        updateExercise(index, { work_seconds })
                      }
                      min={5}
                      max={600}
                      suffix="sec"
                    />
                    <NumberField
                      label="Rest after"
                      value={ex.rest_seconds}
                      onChange={(rest_seconds) =>
                        updateExercise(index, { rest_seconds })
                      }
                      min={0}
                      max={600}
                      suffix="sec"
                    />
                  </div>
                </div>
                {config.exercises.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-400"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        exercises: c.exercises.filter((_, i) => i !== index),
                      }))
                    }
                    aria-label="Remove exercise"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Button
        className="w-full"
        size="lg"
        disabled={isPending || !title.trim()}
        onClick={handleSave}
      >
        {isPending ? "Saving…" : wizard ? "Continue" : "Save HIIT workout"}
      </Button>
    </div>
  );
}
