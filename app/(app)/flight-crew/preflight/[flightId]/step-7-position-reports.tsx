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
 * Step 7 — Flight Following Position Reports (Spec 4 §"The 8 steps / 7").
 *
 * Pilots don't manually submit each position report during the flight
 * — the flight-following service ingests them automatically from the
 * tracker (ADS-B / satellite; per-tenant configured in Settings →
 * Flight Tracking). This step is the pilot's pre-departure confirmation
 * that:
 *
 *   1. They know where the live Flight Following board is (link).
 *   2. Manual position report fallback is available if the tracker
 *      goes offline (link).
 *   3. They understand ETA updates flow automatically.
 *
 * One ack checkbox → completeStepAction. The step-gated backend
 * accepts the completion once step 6 (Accept/Deny) is done.
 */
export function PositionReportsStep({ flightId, flight }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = acknowledged && !pending;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 7, {
        flight_number: flight.flight_number,
        tracker_configured: true,
      });
      if (!result.ok) setError(result.error ?? "Couldn't continue.");
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 7
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Flight Following Position Reports
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-foreground">
          Position reports flow automatically from your aircraft tracker
          during the flight. Confirm you know where to find live tracking
          and the manual-report fallback before you push back.
        </p>

        <ul className="space-y-1.5">
          <ChecklistItem>
            <Link
              href="/flight-following"
              className="font-semibold text-status-blue hover:underline"
            >
              Live Flight Following board
            </Link>{" "}
            — your flight will appear on the ops board as soon as you
            depart.
          </ChecklistItem>
          <ChecklistItem>
            ETA updates recalculate every 5 minutes from position + wind
            data. No pilot action required.
          </ChecklistItem>
          <ChecklistItem>
            If the tracker drops (dead spot, hardware fault), call
            dispatch on the ops frequency and give a verbal position
            report — dispatch will log it manually.
          </ChecklistItem>
        </ul>

        <label className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-status-blue"
          />
          <span>
            I acknowledge how position reporting works on this leg and
            know the manual fallback if the tracker fails.
          </span>
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 8 →"}
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

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground">
      <span aria-hidden className="mt-0.5 text-status-blue">
        •
      </span>
      <span>{children}</span>
    </li>
  );
}
