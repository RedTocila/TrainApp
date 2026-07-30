"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { usePlatformCopy } from "@/components/locale-provider";
import { pickGalleryImage } from "@/lib/pick-gallery-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProgressPhotoCameraCaptureProps = {
  onCapture: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function ProgressPhotoCameraCapture({
  onCapture,
  disabled = false,
  className,
}: ProgressPhotoCameraCaptureProps) {
  const platform = usePlatformCopy();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">(
    "starting"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pickingGallery, setPickingGallery] = useState(false);

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
            facingMode: { ideal: "user" },
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
        setCameraError(platform.photos.cameraUnavailable);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [platform.photos.cameraUnavailable]);

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
        const file = new File([blob], `progress-${Date.now()}.jpg`, {
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
          "absolute inset-0 h-full w-full scale-x-[-1] object-cover",
          cameraState !== "ready" && "opacity-0"
        )}
        playsInline
        muted
        autoPlay
      />

      {cameraState === "starting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-sm text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          {platform.photos.startingCamera}
        </div>
      ) : null}

      {cameraState === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
          <Camera className="h-8 w-8 text-white/50" />
          <p className="text-sm text-white/70">
            {cameraError ?? platform.photos.cameraUnavailable}
          </p>
          <p className="text-xs text-white/50">
            {platform.photos.useGalleryInstead}
          </p>
        </div>
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
            {platform.photos.fromGallery}
          </button>

          <button
            type="button"
            disabled={disabled || cameraState !== "ready"}
            onClick={handleShutter}
            className="mx-auto flex flex-col items-center gap-1.5"
          >
            <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] border-white bg-white/15 shadow-lg backdrop-blur-sm disabled:opacity-40">
              <span className="h-14 w-14 rounded-full bg-white shadow-inner" />
            </span>
            <span className="text-xs font-semibold text-white/90">
              {platform.photos.snapshot}
            </span>
          </button>

          {/* Spacer to keep shutter centered (matches meal barcode column). */}
          <div aria-hidden className="h-12" />
        </div>
      </div>
    </div>
  );
}

export function ProgressPhotoCaptureDialog({
  open,
  onClose,
  onCapture,
  poseLabel,
  disabled = false,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  poseLabel: string;
  disabled?: boolean;
}) {
  const platform = usePlatformCopy();
  const [mounted, setMounted] = useState(false);

  useLockBodyScroll(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex h-dvh flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={platform.photos.takePosePhoto(poseLabel)}
    >
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            {platform.photos.title}
          </p>
          <h2 className="truncate text-lg font-black text-white">
            {platform.photos.takePosePhoto(poseLabel)}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={platform.common.close}
          className="shrink-0 text-white hover:bg-white/15 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <ProgressPhotoCameraCapture
          disabled={disabled}
          onCapture={(file) => {
            onCapture(file);
            onClose();
          }}
        />
      </div>
    </div>,
    document.body
  );
}
