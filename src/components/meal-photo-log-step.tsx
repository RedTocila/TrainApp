"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { analyzeMealPhotoAction, refineMealPhotoAction } from "@/lib/actions/ai-meal";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import { compressImageFile, fileToDataUrl } from "@/lib/image-compress";
import { type MealFormData } from "@/lib/meal-utils";
import type { MealAnalysisResult } from "@/lib/ai/types";
import { MealAnalysisSummary } from "@/components/meal-analysis-summary";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { ProgressPhotoAlexDialog } from "@/components/progress-photo-alex-dialog";
import { Button } from "@/components/ui/button";

type PhotoPhase = "capture" | "compressing" | "analyzing" | "review";

function isMealPhotoRejected(
  result: unknown
): result is { rejected: true; alexMessage: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "rejected" in result &&
    (result as { rejected?: unknown }).rejected === true &&
    typeof (result as { alexMessage?: unknown }).alexMessage === "string"
  );
}

export function MealPhotoLogStep({
  form,
  onFormChange,
  onError,
  onReadyChange,
  onPhotoDataUrlChange,
  confidence,
  onConfidenceChange,
  onSave,
  isSaving = false,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  onError: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
  onPhotoDataUrlChange?: (dataUrl: string | null) => void;
  confidence: number | null;
  onConfidenceChange: (value: number | null) => void;
  onSave?: () => void;
  isSaving?: boolean;
}) {
  const platform = usePlatformCopy();
  const [phase, setPhase] = useState<PhotoPhase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<MealAnalysisResult | null>(null);
  const [alexRoast, setAlexRoast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const analyzeGenRef = useRef(0);

  const setPhaseWithReady = (next: PhotoPhase) => {
    setPhase(next);
    onReadyChange?.(next === "review");
  };

  const resetToCapture = () => {
    setPreviewUrl(null);
    onPhotoDataUrlChange?.(null);
    setLastAnalysis(null);
    setPhaseWithReady("capture");
    onConfidenceChange(null);
  };

  const analyzeDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      onError(platform.mealLog.readFailed);
      setPhaseWithReady("capture");
      return;
    }

    const [, mimeType, imageBase64] = match;
    onError(null);
    setPhaseWithReady("analyzing");
    const gen = ++analyzeGenRef.current;

    startTransition(async () => {
      try {
        const response = await runServerAction(() =>
          analyzeMealPhotoAction(imageBase64, mimeType)
        );
        if (gen !== analyzeGenRef.current) return;
        if (isActionError(response)) {
          onError(response.error);
          resetToCapture();
          return;
        }
        if (isMealPhotoRejected(response)) {
          setAlexRoast(response.alexMessage);
          resetToCapture();
          return;
        }
        onFormChange(response.form);
        onConfidenceChange(response.result.confidence);
        setLastAnalysis(response.result);
        setPhaseWithReady("review");
      } catch {
        if (gen !== analyzeGenRef.current) return;
        onError(platform.mealLog.uploadTooLarge);
        resetToCapture();
      }
    });
  };

  const handleFile = async (file: File | null) => {
    onError(null);
    setAlexRoast(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError(platform.mealLog.chooseImage);
      return;
    }

    // Invalidate any in-flight analysis from a previous pick.
    analyzeGenRef.current += 1;
    setPhaseWithReady("compressing");
    try {
      const compressed = await compressImageFile(file);
      const dataUrl = await fileToDataUrl(compressed);
      setPreviewUrl(dataUrl);
      onPhotoDataUrlChange?.(dataUrl);
      analyzeDataUrl(dataUrl);
    } catch {
      onError(platform.mealLog.processFailed);
      setPhaseWithReady("capture");
    }
  };

  const handleRetake = () => {
    analyzeGenRef.current += 1;
    setAlexRoast(null);
    onError(null);
    resetToCapture();
  };

  const handleRefineWithSpecification = (specification: string) => {
    if (!previewUrl) {
      onError(platform.mealLog.takePhotoFirst);
      return;
    }

    const match = previewUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      onError(platform.mealLog.readFailed);
      return;
    }

    const [, mimeType, imageBase64] = match;
    onError(null);

    startTransition(async () => {
      try {
        const response = await runServerAction(() =>
          refineMealPhotoAction(
            imageBase64,
            mimeType,
            specification,
            lastAnalysis ?? undefined
          )
        );
        if (isActionError(response)) {
          onError(response.error);
          return;
        }
        if (isMealPhotoRejected(response)) {
          setAlexRoast(response.alexMessage);
          resetToCapture();
          return;
        }
        onFormChange(response.form);
        onConfidenceChange(response.result.confidence);
        setLastAnalysis(response.result);
      } catch {
        onError(platform.mealLog.uploadTooLarge);
      }
    });
  };

  if (phase === "review") {
    return (
      <div className="space-y-4">
        <MealAnalysisSummary
          form={form}
          confidence={confidence}
          imageUrl={previewUrl}
          onRefineWithSpecification={handleRefineWithSpecification}
          isRefining={isPending}
          onSave={onSave}
          isSaving={isSaving}
          saveLabel={platform.mealLog.logMeal}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleRetake}
          disabled={isSaving || isPending}
        >
          {platform.mealLog.retakePhoto}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phase === "compressing" || phase === "analyzing" ? (
        <div className="space-y-3">
          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
              <img
                src={previewUrl}
                alt={platform.mealLog.mealPreview}
                className="mx-auto h-auto max-h-[min(50vh,22rem)] w-full object-contain opacity-80"
              />
            </div>
          ) : null}
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase === "compressing"
              ? "Preparing photo…"
              : "Analyzing meal…"}
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Choose how to add your meal photo — AI analyzes it right away.
          </p>
          <ImageSourceButtons
            layout="tiles"
            onSelect={(file) => void handleFile(file)}
            cameraLabel={platform.mealLog.takePhoto}
            galleryLabel={platform.mealLog.fromGallery}
          />
        </>
      )}

      <ProgressPhotoAlexDialog
        open={Boolean(alexRoast)}
        onClose={() => setAlexRoast(null)}
        title={platform.mealLog.alexNotFoodTitle}
        message={alexRoast ?? ""}
        primaryLabel={platform.mealLog.retakePhoto}
      />
    </div>
  );
}
