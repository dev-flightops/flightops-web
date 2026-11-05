"use client";

import { useCallback, useEffect, useRef } from "react";

import type { LessonMediaProgress } from "@/lib/api/academy";

/** Reports go this often while a video plays: the service holds them to the
 *  clock, so more wouldn't count for more. */
const REPORT_EVERY_MS = 10_000;
/** How long an ended video keeps telling the service, in reports: an hour. */
const MOST_REPEATS = 360;

/** Whose progress to record. Null in the studio's preview, and when an admin
 *  opens someone else's enrollment: nothing is recorded or held back then. */
export interface MediaTracking {
  enrollmentId: string;
  mediaId: string;
}

export interface MediaReport {
  position_seconds?: number;
  duration_seconds?: number;
  page?: number;
  page_count?: number;
}

/** The row back from the service, or null when the report didn't get through. */
export async function postMediaProgress(
  tracking: MediaTracking,
  report: MediaReport,
  options: { keepalive?: boolean } = {},
): Promise<LessonMediaProgress | null> {
  try {
    const response = await fetch(
      `/api/academy/enrollments/${tracking.enrollmentId}/media-progress`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: tracking.mediaId, ...report }),
        keepalive: options.keepalive,
      },
    );
    return response.ok ? ((await response.json()) as LessonMediaProgress) : null;
  } catch {
    return null;
  }
}

/**
 * A video's progress, for any player.
 *
 * `furthest` is what the learner has really played, and the player holds a
 * seek to it. Reports go at most every ten seconds. Once the video has ended,
 * the report repeats until the service counts it, which it may not at once if
 * earlier reports didn't get through.
 */
export function useVideoProgress({
  tracking,
  initialPosition,
  onFinished,
}: {
  tracking: MediaTracking | null;
  initialPosition: number;
  onFinished?: () => void;
}) {
  const furthest = useRef(initialPosition);
  const duration = useRef<number | null>(null);
  const lastSent = useRef(0);
  const sending = useRef(false);
  const unsent = useRef(false);
  const done = useRef(false);
  const again = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedCallback = useRef(onFinished);
  finishedCallback.current = onFinished;

  const send = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      if (!tracking || done.current || sending.current) return;
      sending.current = true;
      lastSent.current = Date.now();
      unsent.current = false;
      const row = await postMediaProgress(
        tracking,
        {
          position_seconds: furthest.current,
          duration_seconds: duration.current ?? undefined,
        },
        options,
      );
      sending.current = false;
      if (row?.finished) {
        done.current = true;
        if (again.current) clearTimeout(again.current);
        finishedCallback.current?.();
      }
    },
    [tracking],
  );

  /** The player has reached `seconds` by playing. */
  const playedTo = useCallback(
    (seconds: number, length: number) => {
      if (Number.isFinite(length) && length > 0) duration.current = length;
      if (seconds > furthest.current) {
        furthest.current = seconds;
        unsent.current = true;
      }
      if (Date.now() - lastSent.current >= REPORT_EVERY_MS) void send();
    },
    [send],
  );

  const ended = useCallback(
    (length: number) => {
      if (!tracking) return;
      if (Number.isFinite(length) && length > 0) {
        duration.current = length;
        furthest.current = length;
      }
      let left = MOST_REPEATS;
      const tell = () => {
        if (done.current || left-- <= 0) return;
        void send();
        again.current = setTimeout(tell, REPORT_EVERY_MS);
      };
      if (again.current) clearTimeout(again.current);
      tell();
    },
    [tracking, send],
  );

  useEffect(() => {
    if (!tracking) return;
    const closing = () => {
      if (unsent.current) void send({ keepalive: true });
    };
    window.addEventListener("pagehide", closing);
    return () => {
      window.removeEventListener("pagehide", closing);
      if (again.current) clearTimeout(again.current);
      closing();
    };
  }, [tracking, send]);

  return { furthest, playedTo, ended };
}
