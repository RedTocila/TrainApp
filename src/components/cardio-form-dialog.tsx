"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  createClientCardio,
  updateClientCardio,
  type SaveCardioInput,
} from "@/lib/actions/user-cardio";
import { isValidYoutubeUrl } from "@/lib/youtube";
import type { ClientCardio } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CardioFormDialogProps {
  open: boolean;
  cardio?: ClientCardio | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CardioFormDialog({
  open,
  cardio,
  onClose,
  onSaved,
}: CardioFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle(cardio?.title ?? "");
    setDescription(cardio?.description ?? "");
    setYoutubeUrl(cardio?.youtube_url ?? "");
    setDurationMinutes(
      cardio?.duration_minutes != null ? String(cardio.duration_minutes) : ""
    );
    setError(null);
  }, [open, cardio]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleSave = () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (youtubeUrl.trim() && !isValidYoutubeUrl(youtubeUrl)) {
      setError("Enter a valid YouTube URL");
      return;
    }

    const parsedDuration = durationMinutes.trim()
      ? parseInt(durationMinutes, 10)
      : null;

    const input: SaveCardioInput = {
      title,
      description: description.trim() || null,
      youtubeUrl: youtubeUrl.trim() || null,
      durationMinutes: parsedDuration,
    };

    setError(null);
    startTransition(async () => {
      const result = cardio
        ? await updateClientCardio(cardio.id, input)
        : await createClientCardio(input);

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{cardio ? "Edit cardio" : "Add cardio"}</h2>
            <p className="text-sm text-muted-foreground">
              Save a cardio session with an optional YouTube follow-along link.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1">
            <Label htmlFor="cardio-title">Title</Label>
            <Input
              id="cardio-title"
              placeholder="e.g. 30 min incline walk"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cardio-youtube">YouTube URL</Label>
            <Input
              id="cardio-youtube"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cardio-duration">Duration (minutes)</Label>
            <Input
              id="cardio-duration"
              type="number"
              min={1}
              max={300}
              placeholder="30"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cardio-description">Notes (optional)</Label>
            <Textarea
              id="cardio-description"
              placeholder="Incline 12, speed 3.5…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={isPending || !title.trim()} onClick={handleSave}>
            {isPending ? "Saving…" : cardio ? "Save changes" : "Add cardio"}
          </Button>
        </div>
      </div>
    </div>
  );
}
