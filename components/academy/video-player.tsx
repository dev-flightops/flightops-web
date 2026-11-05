"use client";

import { useEffect, useRef, useState } from "react";

import { type MediaTracking, useVideoProgress } from "./media-progress";

/** How far past the furthest point a seek can land before it's sent back. */
const SEEK_SLACK_SECONDS = 1;
/** A jump bigger than this between two ticks of the clock is a seek, not play. */
const LARGEST_TICK_SECONDS = 5;

export const SKIP_HINT = "Skipping ahead is off until you've watched this video to the end.";
export const VIDEO_PROBLEM =
  "This video won't play here. If it keeps happening, tell your training manager: they can replace it.";

/**
 * A video file in the browser's own player: uploaded, in the library, or on
 * the web. While it has to be watched, a seek past the furthest point goes
 * back there. Skipping back and watching again are always fine.
 */
export function VideoPlayer({
  src,
  title,
  tracking,
  initialPosition = 0,
  onFinished,
}: {
  src: string;
  title: string;
  tracking: MediaTracking | null;
  initialPosition?: number;
  onFinished?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [held, setHeld] = useState(tracking !== null);
  const [skipped, setSkipped] = useState(false);
  const [problem, setProblem] = useState(false);
  const reloaded = useRef(false);
  const { furthest, playedTo, ended } = useVideoProgress({
    tracking,
    initialPosition,
    onFinished: () => {
      setHeld(false);
      setSkipped(false);
      onFinished?.();
    },
  });

  const resume = (element: HTMLVideoElement) => {
    if (held && furthest.current > 0) element.currentTime = furthest.current;
  };

  // The page is sent with the video already in it, so the browser can have
  // read its length before this code is listening for that.
  useEffect(() => {
    if (video.current && video.current.readyState >= 1) resume(video.current);
    // Once, on arrival.
  }, []);

  return (
    <div>
      <video
        ref={video}
        src={src}
        title={title}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        className="block w-full bg-black"
        onLoadedMetadata={(e) => resume(e.currentTarget)}
        onSeeking={(e) => {
          if (held && e.currentTarget.currentTime > furthest.current + SEEK_SLACK_SECONDS) {
            e.currentTarget.currentTime = furthest.current;
            setSkipped(true);
          }
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.seeking) return;
          if (el.currentTime - furthest.current <= LARGEST_TICK_SECONDS) {
            playedTo(el.currentTime, el.duration);
          }
        }}
        onEnded={(e) => ended(e.currentTarget.duration)}
        onError={(e) => {
          // A bucket link that has run out: a fresh one once, from where it was.
          if (!reloaded.current) {
            reloaded.current = true;
            e.currentTarget.load();
            return;
          }
          setProblem(true);
        }}
      />
      {skipped && held ? (
        <p className="mt-2 text-xs text-muted-foreground">{SKIP_HINT}</p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 notice notice-red">
          {VIDEO_PROBLEM}
        </p>
      ) : null}
    </div>
  );
}
