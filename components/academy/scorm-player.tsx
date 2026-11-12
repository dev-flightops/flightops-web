"use client";

import { useEffect, useRef, useState } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { mediaRefusalWords } from "@/lib/academy/media";
import type { LessonMedia, ScormAttempt } from "@/lib/api/academy";

/** What the run's own page posts after each save (the service's runtime). */
interface ScormMessage {
  type: "flightops-scorm";
  mediaId: string;
  status: string;
  finished: boolean;
  scorePercent: number | null;
}

interface Launch {
  url: string;
  origin: string;
}

const STATUS_WORDS: Record<string, string> = {
  passed: "Passed",
  completed: "Completed",
  failed: "Failed: take it again to pass",
  incomplete: "In progress",
  browsed: "Looked through, not completed",
  "not attempted": "Not started",
  unknown: "In progress",
};

/** "Passed · 90% · 12 min": a run, in words. */
export function scormResultText(
  status: string,
  scorePercent: number | null | undefined,
  totalSeconds?: number,
): string {
  const parts = [STATUS_WORDS[status] ?? status];
  if (scorePercent !== null && scorePercent !== undefined) parts.push(`${Math.round(scorePercent)}%`);
  if (totalSeconds && totalSeconds >= 60) parts.push(`${Math.round(totalSeconds / 60)} min`);
  return parts.join(" · ");
}

/**
 * A SCORM package in a lesson (the bug doc's Section 6). It runs in a frame
 * from the API's own address under a link the service gives for this run,
 * never beside the app: the package is the author's code, and there it has
 * no login to act with. After each save the run's page posts its status
 * here; once the service reads it as passed or completed, the lesson moves
 * on, as for a watched video.
 *
 * With an `enrollmentId` it is the learner's own run; without one (the
 * studio, or an admin looking at someone's enrollment) it is the viewer's
 * own preview, which counts for nothing.
 */
export function ScormPlayer({
  item,
  enrollmentId,
  attempt,
  finished,
  onFinished,
}: {
  item: LessonMedia;
  enrollmentId: string | null;
  attempt?: ScormAttempt;
  finished: boolean;
  onFinished?: () => void;
}) {
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; scorePercent: number | null } | null>(
    attempt ? { status: attempt.status, scorePercent: attempt.score_percent } : null,
  );
  const finishedCallback = useRef(onFinished);
  finishedCallback.current = onFinished;
  const told = useRef(finished);

  useEffect(() => {
    if (!launch) return;
    const listen = (event: MessageEvent) => {
      if (event.origin !== launch.origin) return;
      const data = event.data as Partial<ScormMessage> | null;
      if (!data || data.type !== "flightops-scorm" || data.mediaId !== item.id) return;
      setResult({ status: String(data.status ?? ""), scorePercent: data.scorePercent ?? null });
      if (data.finished && enrollmentId && !told.current) {
        told.current = true;
        finishedCallback.current?.();
      }
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [launch, item.id, enrollmentId]);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        enrollmentId
          ? `/api/academy/enrollments/${enrollmentId}/scorm-launch/${item.id}`
          : `/api/academy/media/${item.id}/scorm-preview`,
        { method: "POST" },
      );
      const text = await response.text();
      if (!response.ok) {
        setError(mediaRefusalWords(text) ?? "The module couldn't be opened. Try again in a moment.");
        return;
      }
      setLaunch(JSON.parse(text) as Launch);
    } catch {
      setError("The module couldn't be opened. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const begun = Boolean(attempt && attempt.launch_count > 0);
  const label = !enrollmentId ? "Preview the module" : begun ? "Carry on with the module" : "Start the module";

  return (
    <div className="rounded-lg border border-border bg-card">
      {launch ? (
        <>
          <iframe
            title={item.title}
            src={launch.url}
            className="block h-[min(80vh,760px)] w-full rounded-t-lg border-0 bg-white"
            allow="autoplay; fullscreen; clipboard-write"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">
              {result ? scormResultText(result.status, result.scorePercent) : "Saved as you go."}
              {!enrollmentId ? " A preview counts for nothing." : null}
            </span>
            <button type="button" className={buttonOutline} onClick={() => setLaunch(null)}>
              Close the module
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {result && result.status !== "not attempted"
              ? scormResultText(result.status, result.scorePercent, attempt?.total_seconds)
              : `A SCORM ${item.scorm?.version ?? ""} module. It saves as you go, and picks up where you left off.`}
          </span>
          <button type="button" className={buttonSolid} disabled={pending} onClick={() => void start()}>
            {pending ? "Opening…" : label}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mx-4 mb-3 notice notice-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
