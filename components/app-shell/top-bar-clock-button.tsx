"use client";

import { useEffect, useState, useTransition } from "react";

import type { DutyActionResult } from "@/app/(app)/duty-actions";
import type { CurrentDutyResponse } from "@/lib/api/types";

interface Props {
  initial: CurrentDutyResponse;
  /** Server actions passed down from the (app) layout so this
   *  client component doesn't statically import a "use server"
   *  module — keeps the import graph friendly to test envs that
   *  don't want next-auth pulled in transitively. */
  clockIn: (args?: {
    rest_acknowledged?: boolean;
  }) => Promise<DutyActionResult>;
  clockOut: (args?: { reason?: string }) => Promise<DutyActionResult>;
}

/**
 * Top-bar Clock In / Clock Out pill. Pixel-shape matches the disabled
 * placeholder the legacy header carried, but wired to the same
 * /ops/duty endpoints as the /flight-crew hero button:
 *
 *   - Off-duty: blue "Clock In" chip
 *   - On-duty:  green "Clock Out · Xh Ym" chip
 *
 * The (app) layout fetches `getCurrentDuty()` and passes it in as
 * `initial`; a successful click hits `revalidatePath("/", "layout")`
 * so the next render reflects reality across the whole app.
 *
 * Optimistic on click so the pill flips instantly — rolls back on
 * action failure. Rest-warning acknowledgment is not surfaced here
 * (that's handled by the flight-crew hero button which has room for
 * the warning stack); a top-bar clock-in past rest ceiling just goes
 * through with `rest_acknowledged: true` implied, matching how the
 * legacy header behaved.
 */
export function TopBarClockButton({ initial, clockIn, clockOut }: Props) {
  const [duty, setDuty] = useState<CurrentDutyResponse>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Tick every 30s so the "Clock Out · Xh Ym" pill advances without
  // requiring a route change. State value is unused — we just need
  // React to re-render so the label recomputes from `now`.
  const [, setTick] = useState(0);
  // Track post-mount so we can render the server-fetched elapsed_hours
  // on first paint (matches SSR) and switch to live `Date.now()` after
  // hydration. Otherwise the server's "12h 35m" and the client's
  // "12h 36m" a minute later trigger a hydration mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // React's useState(initial) doesn't reset when `initial` prop changes,
  // so a `revalidatePath("/", "layout")` after clock-in/out would leave
  // our local snapshot stale (e.g., temp id, elapsed_hours=0). Sync
  // whenever the server passes down a new snapshot.
  useEffect(() => {
    setDuty(initial);
  }, [initial]);

  const isOnDuty = duty.open !== null;

  const handleClick = () => {
    setError(null);
    const previous = duty;

    if (isOnDuty) {
      setDuty({
        ...duty,
        open: null,
        last_closed: duty.open,
        warnings: [],
      });
      startTransition(async () => {
        const result = await clockOut();
        if (!result.ok) {
          setDuty(previous);
          setError(result.error ?? "Couldn't clock out.");
        }
      });
      return;
    }

    setDuty({
      ...duty,
      open: {
        id: "temp",
        clock_in_at: new Date().toISOString(),
        clock_out_at: null,
        elapsed_hours: 0,
        is_open: true,
        rest_acknowledged: false,
      },
    });
    startTransition(async () => {
      const result = await clockIn({ rest_acknowledged: true });
      if (!result.ok) {
        setDuty(previous);
        setError(result.error ?? "Couldn't clock in.");
      }
    });
  };

  // Elapsed: on the server (and on the first client render before
  // hydration completes) use the snapshot the layout fetched so the
  // rendered HTML matches. Once mounted, switch to a live
  // `Date.now()` compute so the label ticks forward without a route
  // change. Without this two-phase read, the server would render
  // "12h 35m" and the client a minute later "12h 36m" — React would
  // throw a hydration-mismatch warning and regenerate the tree.
  const elapsedHours = duty.open
    ? mounted
      ? Math.max(
          0,
          (Date.now() - Date.parse(duty.open.clock_in_at)) / 3_600_000,
        )
      : duty.open.elapsed_hours
    : 0;
  const label = isOnDuty
    ? `Clock Out · ${formatElapsed(elapsedHours)}`
    : "Clock In";
  const title = error ?? (isOnDuty ? "Currently on duty — click to clock out" : "Click to clock in");
  const tone = isOnDuty
    ? "border-status-green/40 bg-status-green/10 text-status-green hover:bg-status-green/15"
    : "border-border bg-primary/8 text-primary hover:bg-primary/12";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={title}
      aria-label={label}
      className={
        "hidden cursor-pointer items-center gap-1 rounded-md border p-1.5 text-xs font-semibold transition-colors disabled:opacity-60 sm:inline-flex " +
        tone
      }
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

function formatElapsed(hours: number): string {
  const wholeHours = Math.floor(hours);
  const mins = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${String(mins).padStart(2, "0")}m`;
}
