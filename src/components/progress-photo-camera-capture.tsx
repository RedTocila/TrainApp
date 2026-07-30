"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

type ProgressPhotoCameraCaptureProps = {
  onCapture: (file: File) => void;
  disabled?: boolean;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function ProgressPhotoCameraCapture({
  onCapture,
  disabled = false,
}: ProgressPhotoCameraCaptureProps) {
  const platform = usePlatformCopy();
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">(
    "starting"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  const handleGalleryChange = (file: File | undefined) => {
    if (file) onCapture(file);
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={videoRef}
          className={cn(
            "aspect-[3/4] w-full scale-x-[-1] object-cover",
            cameraState !== "ready" && "opacity-0"
          )}
          playsInline
          muted
          autoPlay
        />

        {cameraState === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/40 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {platform.photos.startingCamera}
          </div>
        ) : null}

        {cameraState === "error" ? (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 bg-secondary/30 px-6 text-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {cameraError ?? platform.photos.cameraUnavailable}
            </p>
            <p className="text-xs text-muted-foreground">
              {platform.photos.useGalleryInstead}
            </p>
          </div>
        ) : null}
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleGalleryChange(e.target.files?.[0])}
      />

      <div className="grid grid-cols-2 items-end gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          {platform.photos.fromGallery}
        </button>

        <button
          type="button"
          disabled={disabled || cameraState !== "ready"}
          onClick={handleShutter}
          className="flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/15 disabled:opacity-40"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-foreground/80 bg-white shadow-lg">
            <span className="h-10 w-10 rounded-full bg-white ring-2 ring-black/10" />
          </span>
          {platform.photos.snapshot}
        </button>
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

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={platform.photos.takePosePhoto(poseLabel)}
      description={platform.photos.captureHint}
      maxWidth="max-w-md"
      className="max-h-[min(94%,40rem)]"
    >
      <div className="px-5 pb-5">
        {open ? (
          <ProgressPhotoCameraCapture
            disabled={disabled}
            onCapture={(file) => {
              onCapture(file);
              onClose();
            }}
          />
        ) : null}
      </div>
    </AppDialog>
  );
}
