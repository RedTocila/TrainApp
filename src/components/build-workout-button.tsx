"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, Hammer, Sparkles, Zap } from "lucide-react";
import { AppOverlay } from "@/components/app-overlay";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { AiBuildPromptPanel } from "@/components/ai-build-prompt-panel";
import { usePlatformCopy } from "@/components/locale-provider";
import type { CreateWorkoutType } from "@/components/workout-type-chooser";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import { cn } from "@/lib/utils";

type PickerStep = "method" | "manual" | "ai";

export function BuildWorkoutButton({
  className,
  folderId = UNCATEGORIZED_FOLDER_ID,
  size = "sm",
}: {
  className?: string;
  folderId?: string;
  size?: "sm" | "default";
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>("method");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<CreateWorkoutType | null>(null);

  useEffect(() => {
    if (!pickerOpen) {
      const frame = window.requestAnimationFrame(() => setStep("method"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [pickerOpen]);

  const closePicker = () => setPickerOpen(false);

  const startManual = (type: CreateWorkoutType) => {
    setWizardType(type);
    setPickerOpen(false);
    setWizardOpen(true);
  };

  const methodOptions = [
    {
      id: "ai" as const,
      label: platform.workout.buildWithAi,
      icon: Sparkles,
      accent: "text-primary",
      onSelect: () => setStep("ai"),
    },
    {
      id: "manual" as const,
      label: platform.workout.buildManually,
      icon: Hammer,
      accent: "text-foreground",
      onSelect: () => setStep("manual"),
    },
  ];

  const manualOptions = [
    {
      id: "strength" as const,
      label: platform.workout.fitnessWorkout,
      icon: Dumbbell,
      accent: "text-primary",
      onSelect: () => startManual("strength"),
    },
    {
      id: "hiit" as const,
      label: platform.workout.hiitWorkout,
      icon: Zap,
      accent: "text-fuchsia-400",
      onSelect: () => startManual("hiit"),
    },
  ];

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className={cn(
          "h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-black tracking-[0.12em]",
          className
        )}
        onClick={() => setPickerOpen(true)}
        aria-label={platform.workout.buildCta}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {platform.workout.buildCta}
      </Button>

      <AppOverlay open={pickerOpen} onClose={closePicker} presentation="center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            step === "ai"
              ? platform.workout.buildWithAi
              : platform.workout.buildCta
          }
          className={cn(
            "relative z-10 w-full px-4",
            step === "ai" ? "max-w-md" : "max-w-sm"
          )}
        >
          {step !== "method" ? (
            <button
              type="button"
              onClick={() => setStep("method")}
              className="mb-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {platform.common.back}
            </button>
          ) : null}

          {step === "ai" ? (
            <AiBuildPromptPanel
              placeholder={platform.workout.aiFullDayPlaceholder}
              buildPrompt={(focus) =>
                `Build me a workout plan. Focus: ${focus}`
              }
              onSubmitted={closePicker}
              accent="violet"
            />
          ) : (
            <div
              className={cn(
                "grid gap-8",
                (step === "method" ? methodOptions : manualOptions).length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
              )}
            >
              {(step === "method" ? methodOptions : manualOptions).map(
                (option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={option.onSelect}
                      className="flex flex-col items-center gap-3 transition-transform duration-200 active:scale-95"
                    >
                      <Icon
                        className={cn("h-12 w-12", option.accent)}
                        strokeWidth={1.75}
                      />
                      <span className="text-center text-sm font-bold leading-tight text-foreground">
                        {option.label}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      </AppOverlay>

      <AddWorkoutWizard
        open={wizardOpen}
        folderId={folderId}
        initialType={wizardType}
        onClose={() => {
          setWizardOpen(false);
          setWizardType(null);
        }}
        onComplete={() => {
          setWizardOpen(false);
          setWizardType(null);
          router.refresh();
        }}
      />
    </>
  );
}
