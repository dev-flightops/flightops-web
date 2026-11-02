"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { linkCaps } from "@/components/ff/controls";
import type { FlightDetail, FlightLogResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
  /** The flight's log, when there is one: the draft its arrival opened,
   *  filled from the flight (the client, 30 Oct). */
  flightLog?: FlightLogResponse | null;
}

/**
 * Step 8 — Post-Flight Log (Spec 4 §"The 8 steps / 8").
 *
 * The last preflight step is a handoff, not a task: the pilot lands,
 * opens the electronic flight log for this leg, and files it. This
 * step both:
 *
 *   1. Opens the flight's draft log, which its arrival on Flight
 *      Following filled in (the client, 30 Oct: "is post flight e-log
 *      automatically filled data acquired during the flight?"), or the
 *      /flight-crew/elog inbox before the arrival is recorded.
 *   2. Records the completion so the preflight_steps row lands and
 *      the 8-of-8 "All done" panel renders.
 *
 * We deliberately mark this step complete BEFORE the pilot has
 * actually finished the elog — Spec 4 treats step 8 as "confirmed
 * you know where to file it", not "elog submitted". Elog completion
 * is its own auditable event (Spec 4 §"Elog submission chain").
 */
export function PostFlightLogStep({ flightId, flight, flightLog = null }: Props) {
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
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="eyebrow">Step 8</p>
        <h2 className="caption-caps mt-1 text-lg text-foreground">Post-Flight Log</h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-foreground">
          After landing, file the electronic flight log for this leg.
          Confirm here that you know where to file it — the elog itself
          is a separate workflow with its own submission audit.
        </p>

        <div className="notice notice-blue">
          <p className="notice-label">File the elog</p>
          {flightLog === null ? (
            <p className="mt-1 text-xs text-foreground">
              When dispatch records the arrival of{" "}
              <span className="font-mono font-semibold">{flight.flight_number}</span>{" "}
              ({flight.origin} → {flight.destination}), its log opens as a draft, already
              filled from the flight. It&apos;s in your logbook then.
            </p>
          ) : flightLog.status === "draft" ? (
            <p className="mt-1 text-xs text-foreground">
              {`Your log for ${flight.flight_number} is waiting as a draft, filled from the flight: `}
              a leg per stop, the crew, each leg&apos;s weights from the manifest, the planned
              fuel, and the takeoff and landing Flight Following recorded. Add what happened in
              the air, correct anything (extra fuel, a stop&apos;s times), and submit.
            </p>
          ) : (
            <p className="mt-1 text-xs text-foreground">
              {`Your log for ${flight.flight_number} is ${flightLog.status}.`}
            </p>
          )}
          <Link
            href={flightLog ? `/flight-crew/elog/${flightLog.id}` : "/flight-crew/elog"}
            className={cn(linkCaps, "mt-2")}
          >
            {flightLog ? "Open your log" : "Open Flight Log"} <span aria-hidden>›</span>
          </Link>
        </div>

        <div className="notice notice-gray text-muted-foreground">
          <span className="notice-label">Reminder</span>
          the elog submit chain writes Hobbs to the aircraft, refreshes
          rolling currency, and opens a maintenance squawk if you
          logged an MX discrepancy — file it promptly so the airframe
          record + your currency both stay accurate.
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleComplete}
          className="btn-caps inline-flex w-full items-center justify-center rounded-md bg-status-green-fill px-4 py-2.5 text-white transition-opacity hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Mark preflight complete ✓"}
        </button>

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
