"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { analyzeMealPhotoAction, refineMealPhotoAction } from "@/lib/actions/ai-meal";
import { lookupBarcodeProductAction } from "@/lib/actions/barcode-product";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import { compressImageFile, fileToDataUrl } from "@/lib/image-compress";
import { type MealFormData } from "@/lib/meal-utils";
import type { MealAnalysisResult } from "@/lib/ai/types";
import { MealAnalysisSummary } from "@/components/meal-analysis-summary";
import { MealCameraCapture } from "@/components/meal-camera-capture";
import { ProgressPhotoAlexDialog } from "@/components/progress-photo-alex-dialog";
import { Button } from "@/components/ui/button";

type PhotoPhase =
  | "capture"
  | "compressing"
  | "analyzing"
  | "lookingUpBarcode"
  | "review";

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
  isSaving = false,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  onError: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
  onPhotoDataUrlChange?: (dataUrl: string | null) => void;
  confidence: number | null;
  onConfidenceChange: (value: number | null) => void;
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
      const compressed = await compressImageFile(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.88,
      });
      const dataUrl = await fileToDataUrl(compressed);
      setPreviewUrl(dataUrl);
      onPhotoDataUrlChange?.(dataUrl);
      analyzeDataUrl(dataUrl);
    } catch {
      onError(platform.mealLog.processFailed);
      setPhaseWithReady("capture");
    }
  };

  const handleBarcode = (code: string) => {
    onError(null);
    setAlexRoast(null);
    analyzeGenRef.current += 1;
    const gen = analyzeGenRef.current;
    setPreviewUrl(null);
    onPhotoDataUrlChange?.(null);
    setLastAnalysis(null);
    setPhaseWithReady("lookingUpBarcode");

    startTransition(async () => {
      try {
        const response = await runServerAction(() =>
          lookupBarcodeProductAction(code)
        );
        if (gen !== analyzeGenRef.current) return;
        if (isActionError(response)) {
          onError(response.error);
          resetToCapture();
          return;
        }
        if (!response.found) {
          onError(response.error ?? platform.mealLog.barcodeNotFound);
          resetToCapture();
          return;
        }
        onFormChange(response.form);
        onConfidenceChange(response.confidence);
        setPreviewUrl(response.imageUrl);
        setPhaseWithReady("review");
      } catch {
        if (gen !== analyzeGenRef.current) return;
        onError(platform.mealLog.barcodeLookupFailed);
        resetToCapture();
      }
    });
  };

  const handleRetake = () => {
    analyzeGenRef.current += 1;
    setAlexRoast(null);
    onError(null);
    resetToCapture();
  };

  const handleRefineWithSpecification = (specification: string) => {
    if (!previewUrl || !previewUrl.startsWith("data:")) {
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

  const canRefineWithAi = Boolean(previewUrl?.startsWith("data:"));

  if (phase === "review") {
    return (
      <div className="space-y-4">
        <MealAnalysisSummary
          form={form}
          confidence={confidence}
          imageUrl={previewUrl}
          onRefineWithSpecification={
            canRefineWithAi ? handleRefineWithSpecification : undefined
          }
          isRefining={isPending}
          isSaving={isSaving}
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

  const isBusy =
    phase === "compressing" ||
    phase === "analyzing" ||
    phase === "lookingUpBarcode";

  if (isBusy) {
    return (
      <div className="absolute inset-0 flex flex-col bg-black">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={platform.mealLog.mealPreview}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">
            {phase === "compressing"
              ? platform.mealLog.preparingPhoto
              : phase === "lookingUpBarcode"
                ? platform.mealLog.lookingUpBarcode
                : platform.mealLog.analyzingMeal}
          </p>
        </div>
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

  if (phase === "capture") {
    return (
      <>
        <MealCameraCapture
          onCapture={(file) => void handleFile(file)}
          onBarcode={handleBarcode}
          disabled={isPending || isSaving}
          className="absolute inset-0"
        />
        <ProgressPhotoAlexDialog
          open={Boolean(alexRoast)}
          onClose={() => setAlexRoast(null)}
          title={platform.mealLog.alexNotFoodTitle}
          message={alexRoast ?? ""}
          primaryLabel={platform.mealLog.retakePhoto}
        />
      </>
    );
  }

  return null;
}
