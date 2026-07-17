"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { FlightDetail } from "@/lib/api/types";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
}

/**
 * Step 8 — Post-Flight Log (Spec 4 §"The 8 steps / 8").
 *
 * The last preflight step is a handoff, not a task: the pilot lands,
 * opens the electronic flight log for this leg, and files it. This
 * step both:
 *
 *   1. Links to the pre-created draft elog for this flight (or the
 *      /flight-crew/elog inbox if no draft exists yet — the pilot
 *      creates one there with the same aircraft / flight picker).
 *   2. Records the completion so the preflight_steps row lands and
 *      the 8-of-8 "All done" panel renders.
 *
 * We deliberately mark this step complete BEFORE the pilot has
 * actually finished the elog — Spec 4 treats step 8 as "confirmed
 * you know where to file it", not "elog submitted". Elog completion
 * is its own auditable event (Spec 4 §"Elog submission chain").
 */
export function PostFlightLogStep({ flightId, flight }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleComplete = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 8, {
        flight_number: flight.flight_number,
      });
      if (!result.ok) setError(result.error ?? "Couldn't complete.");
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 8
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Post-Flight Log
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-foreground">
          After landing, file the electronic flight log for this leg.
          Confirm here that you know where to file it — the elog itself
          is a separate workflow with its own submission audit.
        </p>

        <div className="rounded-lg border border-status-blue/30 bg-status-blue/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-status-blue">
            File the elog
          </p>
          <p className="mt-1 text-xs text-foreground">
            Open the pilot logbook and start a new entry for{" "}
            <span className="font-mono font-semibold">
              {flight.flight_number}
            </span>{" "}
            ({flight.origin} → {flight.destination}). The 7-tab elog
            walks you through legs, W&amp;B, currency, trends, VOR
            check, and any MX discrepancy before you hit Submit.
          </p>
          <Link
            href="/flight-crew/elog"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-status-blue hover:underline"
          >
            Open Flight Log →
          </Link>
        </div>

        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Reminder:</span>{" "}
          the elog submit chain writes Hobbs to the aircraft, refreshes
          rolling currency, and opens a maintenance squawk if you
          logged an MX discrepancy — file it promptly so the airframe
          record + your currency both stay accurate.
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleComplete}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Mark preflight complete ✓"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
