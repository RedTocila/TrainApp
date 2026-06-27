"use client";

import "@livekit/components-styles";
import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLivekitPublicUrl } from "@/lib/livekit-public";

export function ChallengeRoomClient({
  challengeSlug,
  challengeTitle,
}: {
  challengeSlug: string;
  challengeTitle: string;
}) {
  const serverUrl = getLivekitPublicUrl();
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeSlug }),
      });
      const data = (await res.json()) as {
        token?: string;
        roomName?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not join room");
      }
      setToken(data.token ?? null);
      setRoomName(data.roomName ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room");
    } finally {
      setLoading(false);
    }
  }, [challengeSlug]);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  if (!serverUrl) {
    return (
      <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        LiveKit is not configured. Add your LiveKit URL and API keys to the server environment.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-border bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !token || !roomName) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error ?? "Could not connect to the room"}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchToken()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio
        video
        data-lk-theme="default"
        style={{ minHeight: "min(70vh, 32rem)" }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
      <p className="border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        {challengeTitle} — allow camera and microphone when prompted.
      </p>
    </div>
  );
}
