"use client";

import { useEffect, useRef, useState } from "react";

import { type MediaTracking, useVideoProgress } from "./media-progress";
import { SKIP_HINT } from "./video-player";

/** A jump past the furthest point bigger than this is a seek, not play: the
 *  clock here ticks once a second, and a player can run at twice normal speed. */
const SEEK_SLACK_SECONDS = 3;

export const EMBED_PROBLEM =
  "This video can't be played here: its owner may not allow it, or it has been removed. Tell your training manager: they can replace it.";
export const EMBED_LOAD_PROBLEM =
  "The video player couldn't load. Check the connection and open this lesson again.";

interface YouTubePlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

interface VimeoPlayer {
  on(event: string, handler: (data: { seconds: number; duration: number }) => void): void;
  setCurrentTime(seconds: number): Promise<unknown>;
  ready(): Promise<void>;
  destroy(): Promise<void>;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          host: string;
          width: string;
          height: string;
          playerVars: Record<string, number>;
          events: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: () => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: {
      Player: new (
        element: HTMLElement,
        options: { url: string; dnt: boolean; responsive: boolean },
      ) => VimeoPlayer;
    };
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scripts.delete(src);
        reject(new Error(`couldn't load ${src}`));
      };
      document.head.appendChild(script);
    });
    scripts.set(src, loading);
  }
  return loading;
}

function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      resolve();
    };
    loadScript("https://www.youtube.com/iframe_api").catch(reject);
  });
}

/**
 * A YouTube or Vimeo video in its provider's own player, through the
 * provider's API, which says where the video has got to. While it has to be
 * watched, a seek past the furthest point goes back there.
 */
export function EmbedPlayer({
  provider,
  reference,
  title,
  tracking,
  initialPosition = 0,
  onFinished,
}: {
  provider: "youtube" | "vimeo";
  /** The provider's id for the video; for an unlisted Vimeo video, "id/hash". */
  reference: string;
  title: string;
  tracking: MediaTracking | null;
  initialPosition?: number;
  onFinished?: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const held = useRef(tracking !== null);
  const { furthest, playedTo, ended } = useVideoProgress({
    tracking,
    initialPosition,
    onFinished: () => {
      held.current = false;
      setSkipped(false);
      onFinished?.();
    },
  });

  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    let gone = false;
    let clock: ReturnType<typeof setInterval> | null = null;
    let destroy: () => void = () => {};

    const seen = (seconds: number, length: number, sendBack: (to: number) => void) => {
      if (held.current && seconds > furthest.current + SEEK_SLACK_SECONDS) {
        sendBack(furthest.current);
        setSkipped(true);
        return;
      }
      playedTo(seconds, length);
    };

    if (provider === "youtube") {
      loadYouTube()
        .then(() => {
          if (gone || !window.YT) return;
          const yt = window.YT;
          const inner = document.createElement("div");
          element.appendChild(inner);
          const player = new yt.Player(inner, {
            videoId: reference,
            host: "https://www.youtube-nocookie.com",
            width: "100%",
            height: "100%",
            playerVars: {
              playsinline: 1,
              rel: 0,
              start: Math.floor(held.current ? furthest.current : 0),
            },
            events: {
              onError: () => setProblem(EMBED_PROBLEM),
              onStateChange: (event) => {
                if (event.data === yt.PlayerState.ENDED) ended(player.getDuration());
              },
            },
          });
          clock = setInterval(() => {
            if (player.getPlayerState?.() !== yt.PlayerState.PLAYING) return;
            seen(player.getCurrentTime(), player.getDuration(), (to) => player.seekTo(to, true));
          }, 1000);
          destroy = () => player.destroy();
        })
        .catch(() => {
          if (!gone) setProblem(EMBED_LOAD_PROBLEM);
        });
    } else {
      loadScript("https://player.vimeo.com/api/player.js")
        .then(() => {
          if (gone || !window.Vimeo) return;
          const [id, hash] = reference.split("/");
          const player = new window.Vimeo.Player(element, {
            url: hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`,
            dnt: true,
            responsive: true,
          });
          player.ready().catch(() => {
            if (!gone) setProblem(EMBED_PROBLEM);
          });
          player.on("timeupdate", ({ seconds, duration }) =>
            seen(seconds, duration, (to) => void player.setCurrentTime(to)),
          );
          player.on("ended", ({ duration }) => ended(duration));
          if (held.current && furthest.current > 0) void player.setCurrentTime(furthest.current);
          destroy = () => void player.destroy();
        })
        .catch(() => {
          if (!gone) setProblem(EMBED_LOAD_PROBLEM);
        });
    }

    return () => {
      gone = true;
      if (clock) clearInterval(clock);
      destroy();
      element.replaceChildren();
    };
    // The refs carry what changes; the player is made once per video.
  }, [provider, reference]);

  return (
    <div>
      <div
        ref={slot}
        title={title}
        className={provider === "youtube" ? "aspect-video w-full bg-black" : "w-full bg-black"}
      />
      {skipped && held.current ? (
        <p className="mt-2 text-xs text-muted-foreground">{SKIP_HINT}</p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 notice notice-red">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
