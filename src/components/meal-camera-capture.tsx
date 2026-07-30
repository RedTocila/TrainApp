"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, ScanBarcode } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { pickGalleryImage } from "@/lib/pick-gallery-image";
import { cn } from "@/lib/utils";

type CaptureMode = "photo" | "barcode";

type MealCameraCaptureProps = {
  onCapture: (file: File) => void;
  onBarcode: (code: string) => void;
  disabled?: boolean;
  className?: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function MealCameraCapture({
  onCapture,
  onBarcode,
  disabled = false,
  className,
}: MealCameraCaptureProps) {
  const platform = usePlatformCopy();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerStopRef = useRef<(() => void) | null>(null);
  const lastBarcodeRef = useRef<string | null>(null);
  const onBarcodeRef = useRef(onBarcode);
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">(
    "starting"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pickingGallery, setPickingGallery] = useState(false);

  onBarcodeRef.current = onBarcode;

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      setCameraState("starting");
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCameraState("ready");
      } catch {
        if (cancelled) return;
        setCameraState("error");
        setCameraError(platform.mealLog.cameraUnavailable);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      scannerStopRef.current?.();
      scannerStopRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [platform.mealLog.cameraUnavailable]);

  useEffect(() => {
    if (mode !== "barcode" || cameraState !== "ready" || disabled) {
      scannerStopRef.current?.();
      scannerStopRef.current = null;
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    lastBarcodeRef.current = null;

    async function startScanner() {
      try {
        const [{ BrowserMultiFormatReader, BarcodeFormat }, { DecodeHintType }] =
          await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
        if (cancelled || !videoRef.current) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromVideoElement(
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText().trim();
            if (!text || text === lastBarcodeRef.current) return;
            lastBarcodeRef.current = text;
            scannerStopRef.current?.();
            scannerStopRef.current = null;
            onBarcodeRef.current(text);
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        scannerStopRef.current = () => controls.stop();
      } catch {
        if (!cancelled) {
          setCameraError(platform.mealLog.barcodeScanFailed);
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      scannerStopRef.current?.();
      scannerStopRef.current = null;
    };
  }, [
    mode,
    cameraState,
    disabled,
    platform.mealLog.barcodeScanFailed,
  ]);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || cameraState !== "ready" || disabled) return;
    if (!video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `meal-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const handleGallery = async () => {
    if (disabled || pickingGallery) return;
    setPickingGallery(true);
    try {
      const file = await pickGalleryImage();
      if (file) onCapture(file);
    } finally {
      setPickingGallery(false);
    }
  };

  return (
    <div className={cn("relative h-full min-h-0 w-full bg-black", className)}>
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          cameraState !== "ready" && "opacity-0"
        )}
        playsInline
        muted
        autoPlay
      />

      {cameraState === "starting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-sm text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          {platform.mealLog.startingCamera}
        </div>
      ) : null}

      {cameraState === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
          <Camera className="h-8 w-8 text-white/50" />
          <p className="text-sm text-white/70">
            {cameraError ?? platform.mealLog.cameraUnavailable}
          </p>
          <p className="text-xs text-white/50">
            {platform.mealLog.useGalleryInstead}
          </p>
        </div>
      ) : null}

      {mode === "barcode" && cameraState === "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-[78%] max-w-sm rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
      ) : null}

      {mode === "barcode" && cameraState === "ready" ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-36 text-center text-xs font-medium text-white drop-shadow">
          {platform.mealLog.scanBarcodeHint}
        </p>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-16">
        <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-3 items-end gap-2 px-6">
          <button
            type="button"
            disabled={disabled || pickingGallery}
            onClick={() => void handleGallery()}
            className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md">
              {pickingGallery ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
              ) : (
                <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
              )}
            </span>
            {platform.mealLog.fromGallery}
          </button>

          <button
            type="button"
            disabled={disabled || cameraState !== "ready" || mode === "barcode"}
            onClick={handleShutter}
            aria-label={platform.mealLog.takePhoto}
            className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] border-white bg-white/15 shadow-lg backdrop-blur-sm disabled:opacity-40"
          >
            <span className="h-14 w-14 rounded-full bg-white shadow-inner" />
          </button>

          <button
            type="button"
            disabled={disabled || cameraState === "starting"}
            onClick={() =>
              setMode((current) => (current === "barcode" ? "photo" : "barcode"))
            }
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
              mode === "barcode"
                ? "text-primary"
                : "text-white/90 hover:bg-white/10"
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md",
                mode === "barcode"
                  ? "border-primary/50 bg-primary/25"
                  : "border-white/25 bg-black/40"
              )}
            >
              <ScanBarcode className="h-5 w-5" strokeWidth={1.75} />
            </span>
            {platform.mealLog.scanBarcode}
          </button>
        </div>
      </div>
    </div>
  );
}
