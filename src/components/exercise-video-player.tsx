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
  /** When true, force the YouTube player to pause. */
  paused?: boolean;
  /** Fill a parent frame (HIIT) instead of a fixed 16:9 box. */
  fill?: boolean;
  /** Called when the YouTube iframe API reports an unrecoverable error. */
  onError?: () => void;
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
          host?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: {
              data: number;
              target: YtPlayer;
            }) => void;
            onError?: (event: { data: number }) => void;
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

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function ExerciseVideoPlayer({
  videoUrl,
  title,
  autoplay = false,
  paused = false,
  fill = false,
  onError,
}: ExerciseVideoPlayerProps) {
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const startSeconds = videoUrl ? extractYoutubeStartSeconds(videoUrl) : null;
  const thumbnailUrl = videoUrl ? getYoutubeThumbnailUrl(videoUrl) : null;

  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const userPausedRef = useRef(false);
  const onErrorRef = useRef(onError);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(!autoplay);

  pausedRef.current = paused;
  onErrorRef.current = onError;

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
      setShowPlayButton(false);
    }, 1800);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!videoId || !mountRef.current) return;

    let cancelled = false;
    const host = mountRef.current;
    // YT.Player replaces the mount node; keep a stable child to target.
    const target = document.createElement("div");
    target.className = "absolute inset-0 h-full w-full";
    host.replaceChildren(target);
    userPausedRef.current = false;
    setShowPlayButton(!autoplay);
    setPlaying(false);
    setReady(false);

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      const player = new window.YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          // Always start muted — browsers also require mute for autoplay.
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          showinfo: 0,
          ...(startSeconds != null ? { start: startSeconds } : {}),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            setReady(true);
            event.target.mute();
            if (pausedRef.current) {
              event.target.pauseVideo();
              setShowPlayButton(true);
              return;
            }
            if (autoplay) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (cancelled || !window.YT?.PlayerState) return;
            const { PLAYING, PAUSED, ENDED, BUFFERING } = window.YT.PlayerState;
            if (event.data === PLAYING) {
              // Honor external workout pause even if YT tries to play.
              if (pausedRef.current) {
                event.target.pauseVideo();
                return;
              }
              setPlaying(true);
              setShowPlayButton(false);
              return;
            }
            if (event.data === BUFFERING) {
              setPlaying(true);
              return;
            }
            if (event.data === PAUSED || event.data === ENDED) {
              setPlaying(false);
              setShowPlayButton(true);
            }
          },
          onError: () => {
            if (cancelled) return;
            onErrorRef.current?.();
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      clearHideTimer();
      try {
        playerRef.current?.destroy();
      } catch {
        // Player may already be gone with the node.
      }
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
    };
    // Recreate only when the video identity changes — play/pause is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoplay/paused applied in separate effect
  }, [videoId, startSeconds, clearHideTimer]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    try {
      if (paused) {
        player.pauseVideo();
        setPlaying(false);
        setShowPlayButton(true);
      } else if (autoplay && !userPausedRef.current) {
        player.mute();
        player.playVideo();
      }
    } catch {
      // Ignore transient API errors during teardown.
    }
  }, [paused, ready, autoplay]);

  if (!videoId) return null;

  const togglePlay = (event?: MouseEvent) => {
    event?.stopPropagation();
    const player = playerRef.current;
    if (!player || !ready || paused) return;
    if (playing) {
      userPausedRef.current = true;
      player.pauseVideo();
      setShowPlayButton(true);
    } else {
      userPausedRef.current = false;
      player.playVideo();
      setShowPlayButton(false);
    }
  };

  const onShellClick = () => {
    if (paused) return;
    if (playing) {
      // Tap while playing reveals our pause control briefly (mobile) or toggles (desktop).
      if (canHoverFinePointer()) {
        togglePlay();
        return;
      }
      if (!showPlayButton) {
        setShowPlayButton(true);
        scheduleMobileHide();
        return;
      }
      togglePlay();
      return;
    }
    togglePlay();
  };

  const showPoster = !playing;

  return (
    <div
      className={cn(
        "overflow-hidden bg-black",
        fill
          ? "h-full w-full"
          : "rounded-lg border border-border bg-muted"
      )}
    >
      <div
        className={cn(
          "relative cursor-pointer",
          fill ? "h-full w-full" : "aspect-video w-full"
        )}
        onClick={onShellClick}
        role="group"
        aria-label={`${title} demo video`}
      >
        {/*
          Full-size iframe so the video frame matches the stage without crop/zoom.
          Overlay below still blocks residual YouTube chrome from receiving input.
        */}
        <div
          ref={mountRef}
          className={cn(
            "absolute inset-0 h-full w-full overflow-hidden",
            "[&_iframe]:pointer-events-none [&_iframe]:absolute [&_iframe]:inset-0",
            "[&_iframe]:h-full [&_iframe]:w-full"
          )}
        />

        {showPoster && thumbnailUrl ? (
          // Remote YouTube CDN thumbnail; next/image not required here.
          <img
            src={thumbnailUrl}
            alt=""
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain bg-black"
            draggable={false}
          />
        ) : null}

        {/* Blocks YouTube’s residual chrome from receiving input */}
        <div className="absolute inset-0 z-[2]" aria-hidden />

        <div
          className={cn(
            "absolute inset-0 z-[4] flex items-center justify-center transition-opacity duration-150",
            showPlayButton
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
        >
          <button
            type="button"
            onClick={togglePlay}
            disabled={paused}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
            aria-label={playing ? "Pause video" : "Play video"}
          >
            {playing ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current pl-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
