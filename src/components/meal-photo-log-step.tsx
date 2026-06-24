"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { analyzeMealPhotoAction } from "@/lib/actions/ai-meal";
import { compressImageFile, fileToDataUrl } from "@/lib/image-compress";
import {
  formatMealMacrosSummary,
  type MealFormData,
} from "@/lib/meal-utils";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ImageSourceButtons } from "@/components/image-source-buttons";
import { Button } from "@/components/ui/button";

type PhotoPhase = "capture" | "compressing" | "analyzing" | "review";

export function MealPhotoLogStep({
  form,
  onFormChange,
  onError,
  onReadyChange,
  confidence,
  onConfidenceChange,
}: {
  form: MealFormData;
  onFormChange: (form: MealFormData) => void;
  onError: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
  confidence: number | null;
  onConfidenceChange: (value: number | null) => void;
}) {
  const [phase, setPhase] = useState<PhotoPhase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setPhaseWithReady = (next: PhotoPhase) => {
    setPhase(next);
    onReadyChange?.(next === "review");
  };

  const handleFile = async (file: File | null) => {
    onError(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file");
      return;
    }

    setPhaseWithReady("compressing");
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
      });
      const dataUrl = await fileToDataUrl(compressed);
      setPreviewUrl(dataUrl);
      setPhaseWithReady("capture");
    } catch {
      onError("Could not process that photo. Try another image.");
      setPhaseWithReady("capture");
    }
  };

  const handleAnalyze = () => {
    if (!previewUrl) {
      onError("Take or choose a photo first");
      return;
    }

    const match = previewUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      onError("Could not read the photo");
      return;
    }

    const [, mimeType, imageBase64] = match;
    onError(null);
    setPhaseWithReady("analyzing");

    startTransition(async () => {
      try {
        const response = await analyzeMealPhotoAction(imageBase64, mimeType);
        if ("error" in response) {
          onError(response.error);
          setPhaseWithReady("capture");
          return;
        }
        onFormChange(response.form);
        onConfidenceChange(response.result.confidence);
        setPhaseWithReady("review");
      } catch {
        onError("Upload failed — the photo may be too large. Try again or use a smaller image.");
        setPhaseWithReady("capture");
      }
    });
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setPhaseWithReady("capture");
    onConfidenceChange(null);
    onError(null);
  };

  if (phase === "review") {
    const summary = formatMealMacrosSummary(form.macros);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-green-400">
            <Sparkles className="h-4 w-4" />
            AI analysis complete
            {confidence != null && <ConfidenceBadge confidence={confidence} />}
          </p>
          <p className="mt-1 text-sm font-medium">{form.name}</p>
          {summary && (
            <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
          )}
          {form.description && (
            <p className="mt-2 text-xs text-muted-foreground">{form.description}</p>
          )}
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Meal preview"
            className="mx-auto max-h-40 rounded-lg border border-border object-cover"
          />
        )}
        <MealDetailsFields
          mealType={form.meal_type}
          onMealTypeChange={(meal_type) => onFormChange({ ...form, meal_type })}
          name={form.name}
          onNameChange={(name) => onFormChange({ ...form, name })}
          description={form.description}
          onDescriptionChange={(description) => onFormChange({ ...form, description })}
          macros={form.macros}
          onMacrosChange={(macros) => onFormChange({ ...form, macros })}
          ingredients={form.ingredients}
          onIngredientsChange={(ingredients) => onFormChange({ ...form, ingredients })}
        />
        <p className="text-xs text-muted-foreground">
          Edit name, macros, or ingredients if needed, then tap{" "}
          <span className="font-medium text-foreground">Confirm &amp; log meal</span> below.
        </p>
        <Button variant="outline" size="sm" onClick={handleRetake}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Retake photo
        </Button>
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
          alt="Meal preview"
          className="mx-auto max-h-52 w-full rounded-xl border border-border object-cover"
        />
      ) : phase !== "compressing" ? (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8">
          <ImageSourceButtons
            onSelect={(file) => void handleFile(file)}
            disabled={phase === "analyzing"}
            cameraLabel="Take photo"
            galleryLabel="Choose from gallery"
            className="justify-center"
          />
        </div>
      ) : null}

      {previewUrl && (
        <div className="flex flex-wrap gap-2">
          <ImageSourceButtons
            onSelect={(file) => void handleFile(file)}
            disabled={phase === "analyzing" || phase === "compressing"}
            cameraLabel="Retake"
            galleryLabel="Different photo"
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
