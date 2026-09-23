"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const userPausedRef = useRef(false);
  const onErrorRef = useRef(onError);
  const seekingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  pausedRef.current = paused;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!videoId || !mountRef.current) return;

    let cancelled = false;
    const host = mountRef.current;
    const target = document.createElement("div");
    target.className = "h-full w-full";
    host.replaceChildren(target);
    userPausedRef.current = false;
    setPlaying(false);
    setReady(false);
    setCurrentTime(0);
    setDuration(0);

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      const player = new window.YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
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
            try {
              const d = event.target.getDuration();
              if (Number.isFinite(d) && d > 0) setDuration(d);
            } catch {
              // Duration may be 0 until playback starts.
            }
            event.target.mute();
            if (pausedRef.current) {
              event.target.pauseVideo();
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
              if (pausedRef.current) {
                event.target.pauseVideo();
                return;
              }
              setPlaying(true);
              try {
                const d = event.target.getDuration();
                if (Number.isFinite(d) && d > 0) setDuration(d);
              } catch {
                // ignore
              }
              return;
            }
            if (event.data === BUFFERING) {
              setPlaying(true);
              return;
            }
            if (event.data === PAUSED || event.data === ENDED) {
              setPlaying(false);
              if (event.data === ENDED) {
                // Avoid YouTube end-screen titles / related cards.
                try {
                  const d = event.target.getDuration();
                  setCurrentTime(d > 0 ? d : 0);
                  event.target.seekTo(0, true);
                  event.target.pauseVideo();
                  setCurrentTime(0);
                } catch {
                  // ignore
                }
              }
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
      try {
        playerRef.current?.destroy();
      } catch {
        // Player may already be gone with the node.
      }
      playerRef.current = null;
      setReady(false);
      setPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoplay/paused applied in separate effect
  }, [videoId, startSeconds]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    try {
      if (paused) {
        player.pauseVideo();
        setPlaying(false);
      } else if (autoplay && !userPausedRef.current) {
        player.mute();
        player.playVideo();
      }
    } catch {
      // Ignore transient API errors during teardown.
    }
  }, [paused, ready, autoplay]);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const player = playerRef.current;
      if (!player || seekingRef.current) return;
      try {
        const t = player.getCurrentTime();
        const d = player.getDuration();
        if (Number.isFinite(t)) setCurrentTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // ignore
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [ready]);

  const seekFromClientX = useCallback((clientX: number) => {
    const track = progressTrackRef.current;
    const player = playerRef.current;
    if (!track || !player || !ready) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const d =
      duration > 0
        ? duration
        : (() => {
            try {
              return player.getDuration();
            } catch {
              return 0;
            }
          })();
    if (!(d > 0)) return;
    const next = ratio * d;
    setCurrentTime(next);
    try {
      player.seekTo(next, true);
    } catch {
      // ignore
    }
  }, [duration, ready]);

  const onProgressPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!ready || paused) return;
    event.preventDefault();
    event.stopPropagation();
    seekingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  };

  const onProgressPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekingRef.current) return;
    seekFromClientX(event.clientX);
  };

  const onProgressPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekingRef.current) return;
    seekingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  if (!videoId) return null;

  const togglePlay = (event?: MouseEvent) => {
    event?.stopPropagation();
    const player = playerRef.current;
    if (!player || !ready || paused) return;
    if (playing) {
      userPausedRef.current = true;
      player.pauseVideo();
      setPlaying(false);
    } else {
      userPausedRef.current = false;
      player.playVideo();
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const showPoster = !playing && currentTime < 0.35;

  return (
    <div
      className={cn(
        "flex flex-col bg-black",
        fill ? "h-full w-full" : "overflow-hidden rounded-lg border border-border"
      )}
    >
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-black",
          fill ? "w-full" : "aspect-video w-full"
        )}
        role="group"
        aria-label={`${title} demo video`}
      >
        {/*
          Scale + crop the iframe so YouTube title, logo, and end-screen chrome
          sit outside the visible frame. pointer-events none + cover block clicks.
        */}
        <div
          ref={mountRef}
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2 overflow-hidden",
            "[&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
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

        <div className="absolute inset-0 z-[2]" aria-hidden />

        <div className="absolute inset-0 z-[4] flex items-center justify-center">
          <button
            type="button"
            onClick={togglePlay}
            disabled={paused || !ready}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-40"
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

      <div className="shrink-0 bg-black px-3 pb-3 pt-2">
        <div
          ref={progressTrackRef}
          role="slider"
          tabIndex={ready && !paused ? 0 : -1}
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, Math.floor(duration))}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          className={cn(
            "group relative h-1.5 w-full cursor-pointer rounded-full bg-white/20",
            (!ready || paused) && "pointer-events-none opacity-50"
          )}
          onPointerDown={onProgressPointerDown}
          onPointerMove={onProgressPointerMove}
          onPointerUp={onProgressPointerUp}
          onPointerCancel={onProgressPointerUp}
          onKeyDown={(event) => {
            if (!ready || paused || duration <= 0) return;
            const player = playerRef.current;
            if (!player) return;
            let next = currentTime;
            if (event.key === "ArrowRight") next = Math.min(duration, currentTime + 5);
            else if (event.key === "ArrowLeft") next = Math.max(0, currentTime - 5);
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = duration;
            else return;
            event.preventDefault();
            setCurrentTime(next);
            try {
              player.seekTo(next, true);
            } catch {
              // ignore
            }
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
