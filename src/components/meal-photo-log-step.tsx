"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { analyzeMealPhotoAction, refineMealPhotoAction } from "@/lib/actions/ai-meal";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import { compressImageFile, fileToDataUrl } from "@/lib/image-compress";
import { type MealFormData } from "@/lib/meal-utils";
import type { MealAnalysisResult } from "@/lib/ai/types";
import { MealAnalysisSummary } from "@/components/meal-analysis-summary";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { Button } from "@/components/ui/button";

type PhotoPhase = "capture" | "compressing" | "analyzing" | "review";

export function MealPhotoLogStep({
  form,
  onFormChange,
  onError,
  onReadyChange,
  onPhotoDataUrlChange,
  confidence,
  onConfidenceChange,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  onError: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
  onPhotoDataUrlChange?: (dataUrl: string | null) => void;
  confidence: number | null;
  onConfidenceChange: (value: number | null) => void;
}) {
  const platform = usePlatformCopy();
  const [phase, setPhase] = useState<PhotoPhase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<MealAnalysisResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const setPhaseWithReady = (next: PhotoPhase) => {
    setPhase(next);
    onReadyChange?.(next === "review");
  };

  const handleFile = async (file: File | null) => {
    onError(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError(platform.mealLog.chooseImage);
      return;
    }

    setPhaseWithReady("compressing");
    try {
      const compressed = await compressImageFile(file);
      const dataUrl = await fileToDataUrl(compressed);
      setPreviewUrl(dataUrl);
      onPhotoDataUrlChange?.(dataUrl);
      setPhaseWithReady("capture");
    } catch {
      onError(platform.mealLog.processFailed);
      setPhaseWithReady("capture");
    }
  };

  const handleAnalyze = () => {
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
    setPhaseWithReady("analyzing");

    startTransition(async () => {
      try {
        const response = await runServerAction(() =>
          analyzeMealPhotoAction(imageBase64, mimeType)
        );
        if (isActionError(response)) {
          onError(response.error);
          setPhaseWithReady("capture");
          return;
        }
        onFormChange(response.form);
        onConfidenceChange(response.result.confidence);
        setLastAnalysis(response.result);
        setPhaseWithReady("review");
      } catch {
        onError(platform.mealLog.uploadTooLarge);
        setPhaseWithReady("capture");
      }
    });
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    onPhotoDataUrlChange?.(null);
    setLastAnalysis(null);
    setPhaseWithReady("capture");
    onConfidenceChange(null);
    onError(null);
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
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Take a photo or choose one from your gallery. AI will identify the food and estimate
        macros — you can edit everything before logging.
      </p>

      {phase === "compressing" && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Compressing photo…
        </div>
      )}

      {previewUrl ? (
        <img
          src={previewUrl}
          alt={platform.mealLog.mealPreview}
          className="mx-auto max-h-52 w-full rounded-xl border border-border object-cover"
        />
      ) : phase !== "compressing" ? (
        <ImageSourceButtons
          layout="zone"
          onSelect={(file) => void handleFile(file)}
          disabled={phase === "analyzing"}
          zoneLabel={platform.mealLog.addMealPhoto}
        />
      ) : null}

      {previewUrl && (
        <div className="flex flex-wrap gap-2">
          <ImageSourceButtons
            layout="button"
            onSelect={(file) => void handleFile(file)}
            disabled={phase === "analyzing" || phase === "compressing"}
            galleryLabel={platform.mealLog.changePhoto}
          />
          <Button type="button" variant="ghost" size="sm" onClick={handleRetake}>
            Clear
          </Button>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!previewUrl || isPending || phase === "analyzing" || phase === "compressing"}
        onClick={handleAnalyze}
      >
        {isPending || phase === "analyzing" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing meal…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze with AI
          </>
        )}
      </Button>
    </div>
  );
}
