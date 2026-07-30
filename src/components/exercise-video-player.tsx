"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Pause, Play } from "lucide-react";
import {
  extractYoutubeId,
  extractYoutubeStartSeconds,
  getYoutubeThumbnailUrl,
} from "@/lib/youtube";
import { cn } from "@/lib/utils";

interface ExerciseVideoPlayerProps {
  videoUrl?: string | null;
  title: string;
  autoplay?: boolean;
}

type YtPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
};

type YtPlayerState = {
  UNSTARTED: number;
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        config: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: {
              data: number;
              target: YtPlayer;
            }) => void;
          };
        }
      ) => YtPlayer;
      PlayerState: YtPlayerState;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    // API may already be mid-load with a ready callback queue.
    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll);
        resolve();
      }
    }, 50);
  });

  return youtubeApiPromise;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function ExerciseVideoPlayer({
  videoUrl,
  title,
  autoplay = false,
}: ExerciseVideoPlayerProps) {
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const startSeconds = videoUrl ? extractYoutubeStartSeconds(videoUrl) : null;
  const thumbnailUrl = videoUrl ? getYoutubeThumbnailUrl(videoUrl) : null;

  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleMobileHide = useCallback(() => {
    clearHideTimer();
    if (canHoverFinePointer()) return;
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2500);
  }, [clearHideTimer]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleMobileHide();
  }, [scheduleMobileHide]);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(false);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!videoId || !mountRef.current) return;

    let cancelled = false;
    const host = mountRef.current;
    // YT.Player replaces the mount node; keep a stable child to target.
    const target = document.createElement("div");
    target.className = "absolute inset-0 h-full w-full";
    host.replaceChildren(target);

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      const player = new window.YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          ...(startSeconds != null ? { start: startSeconds } : {}),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            setReady(true);
            const d = event.target.getDuration();
            if (Number.isFinite(d) && d > 0) setDuration(d);
            if (autoplay) {
              event.target.mute();
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (cancelled || !window.YT?.PlayerState) return;
            const { PLAYING, PAUSED, ENDED, BUFFERING } = window.YT.PlayerState;
            const isPlaying =
              event.data === PLAYING || event.data === BUFFERING;
            setPlaying(isPlaying);
            if (event.data === PAUSED || event.data === ENDED) {
              setPlaying(false);
            }
            const d = event.target.getDuration();
            if (Number.isFinite(d) && d > 0) setDuration(d);
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      clearHideTimer();
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        playerRef.current?.destroy();
      } catch {
        // Player may already be gone with the node.
      }
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
      setControlsVisible(false);
    };
  }, [videoId, autoplay, startSeconds, clearHideTimer]);

  useEffect(() => {
    if (!ready) return;
    pollRef.current = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime();
        if (Number.isFinite(t)) setCurrentTime(t);
        const d = player.getDuration();
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // Ignore transient API errors during teardown.
      }
    }, 250);
    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [ready]);

  if (!videoId) return null;

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const showPoster = !playing && !controlsVisible;

  const togglePlay = (event: MouseEvent) => {
    event.stopPropagation();
    const player = playerRef.current;
    if (!player || !ready) return;
    if (playing) player.pauseVideo();
    else {
      player.unMute();
      player.playVideo();
    }
    showControls();
  };

  const onSeek = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const player = playerRef.current;
    if (!player || !ready || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    player.seekTo(ratio * duration, true);
    setCurrentTime(ratio * duration);
    showControls();
  };

  const onShellClick = () => {
    if (canHoverFinePointer()) {
      // Desktop: click toggles playback; hover already reveals chrome.
      const player = playerRef.current;
      if (!player || !ready) return;
      if (playing) player.pauseVideo();
      else {
        player.unMute();
        player.playVideo();
      }
      return;
    }
    // Mobile: first tap reveals controls; tap again while visible toggles play.
    if (!controlsVisible) {
      showControls();
      return;
    }
    const player = playerRef.current;
    if (!player || !ready) return;
    if (playing) player.pauseVideo();
    else {
      player.unMute();
      player.playVideo();
    }
    scheduleMobileHide();
  };

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-muted"
      onMouseLeave={() => {
        if (canHoverFinePointer()) hideControls();
      }}
      onMouseMove={() => {
        // Reveal on move only — not mouseenter — so opening under a still
        // cursor (after tapping a thumbnail) keeps chrome hidden.
        if (canHoverFinePointer()) showControls();
      }}
    >
      <div
        className="relative aspect-video w-full cursor-pointer"
        onClick={onShellClick}
        role="group"
        aria-label={`${title} demo video`}
      >
        <div
          ref={mountRef}
          className="absolute inset-0 h-full w-full overflow-hidden [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
        />

        {showPoster && thumbnailUrl ? (
          // Remote YouTube CDN thumbnail; next/image not required here.
          <img
            src={thumbnailUrl}
            alt=""
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
            draggable={false}
          />
        ) : null}

        {/* Blocks YouTube’s residual chrome from receiving input */}
        <div className="absolute inset-0 z-[2]" aria-hidden />

        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/70 via-transparent to-black/25 transition-opacity duration-200",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={cn(
            "absolute inset-0 z-[4] flex flex-col justify-end p-3 transition-opacity duration-200",
            controlsVisible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
        >
          <div className="mb-auto flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
              aria-label={playing ? "Pause video" : "Play video"}
            >
              {playing ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="h-6 w-6 fill-current pl-0.5" />
              )}
            </button>
          </div>

          <div className="space-y-1.5">
            <div
              className="h-1.5 w-full cursor-pointer rounded-full bg-white/25"
              onClick={onSeek}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(currentTime)}
              aria-label="Seek"
              tabIndex={0}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium text-white/90">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
