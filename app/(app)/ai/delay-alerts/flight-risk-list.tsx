"use client";

import { useState } from "react";

import type { DelayAssessment, DelayRiskBand } from "@/lib/api/ai";
import type { FlightListItem } from "@/lib/api/types";

import { assessDelayAction, type AssessResult } from "./actions";

/**
 * The day's flights, each assessable on demand.
 *
 * Follows legacy `templates/ai/delay_alerts.html`: a row per flight
 * with an Assess button that expands an inline reading underneath.
 *
 * FOUR DEPARTURES FROM LEGACY, ALL ABOUT THE LOGIC
 *
 * 1. No risk score. Legacy renders `delay_risk_score` as "73% risk" in
 *    a badge. The service refuses to produce one, and its schema says
 *    why: there is no calculation over a handful of aggregate counts
 *    that lands on 73 rather than 68, and a two-digit number sitting
 *    beside figures that were actually measured borrows their
 *    authority. A band is what the model can honestly give, so a band
 *    is what this shows.
 *
 * 2. No weighted bars. Legacy sizes a bar per contributing factor from
 *    a model-supplied `weight`. A bar is a picture of a measurement;
 *    these are not measured, and our schema carries no weight to draw
 *    one from. The factor and its detail, as text.
 *
 * 3. Measured figures are labelled as measured and shown whether or
 *    not the model answered. `judgement` can be absent — that costs
 *    the reading, not the route and tail history underneath it.
 *
 * 4. A rate the service could not compute is said, not zeroed. Legacy
 *    prints `0%` when there is no history, which turns "we do not
 *    know" into "it never happens" — the more dangerous of the two on
 *    a page about risk.
 *
 * Assessment is per flight and manual: each one spends a model call
 * and reads that flight's own route and tail history, so there is no
 * batch form of it that would mean the same thing.
 */

function bandClasses(band: DelayRiskBand): string {
  if (band === "high") return "bg-status-red/15 text-status-red";
  if (band === "medium") return "bg-status-yellow/15 text-status-yellow";
  return "bg-status-green/15 text-status-green";
}

function hhmmZ(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}z`;
}

/** A rate the service declined to compute is not zero. */
function rate(value: number | null): string {
  return value === null ? "not enough history" : `${Math.round(value * 100)}%`;
}

function Measured({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Assessment({ data }: { data: DelayAssessment }) {
  const { route, aircraft, judgement } = data;
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-[0.65rem] text-status-blue">{data.advisory}</p>

      <div>
        <h4 className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Measured · last {data.window_days} days
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Measured
            label={`${route.origin} → ${route.destination}`}
            value={`${route.flights} flight${route.flights === 1 ? "" : "s"}`}
          />
          <Measured label="Late" value={rate(route.late_rate)} />
          <Measured label="Cancelled" value={rate(route.cancellation_rate)} />
          <Measured
            label={aircraft.tail ?? "Aircraft"}
            value={`${aircraft.flights} flown · ${aircraft.late} late`}
          />
        </div>

        {!route.enough_history && (
          // Said once, plainly. Rates already read "not enough
          // history"; this explains why rather than leaving the reader
          // to infer it from two blanks.
          <p className="mt-1.5 text-xs text-muted-foreground">
            Too few prior flights on this route for the rates to mean
            anything yet.
          </p>
        )}

        {(aircraft.open_squawks > 0 ||
          aircraft.open_mels > 0 ||
          aircraft.is_grounded) && (
          <p className="mt-1.5 text-xs text-status-yellow">
            {aircraft.is_grounded && "Grounded. "}
            {aircraft.open_squawks > 0 &&
              `${aircraft.open_squawks} open squawk${aircraft.open_squawks === 1 ? "" : "s"}`}
            {aircraft.open_squawks > 0 && aircraft.grounding_squawks > 0 &&
              ` (${aircraft.grounding_squawks} grounding)`}
            {aircraft.open_squawks > 0 && aircraft.open_mels > 0 && " · "}
            {aircraft.open_mels > 0 &&
              `${aircraft.open_mels} open MEL${aircraft.open_mels === 1 ? "" : "s"}`}
            .
          </p>
        )}
      </div>

      {data.note && (
        <p className="text-sm text-muted-foreground">{data.note}</p>
      )}

      {judgement ? (
        <div className="space-y-2">
          <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Reading
          </h4>
          {judgement.historical_context && (
            <p className="text-sm text-foreground">
              {judgement.historical_context}
            </p>
          )}
          {judgement.contributing_factors.length > 0 && (
            <ul className="space-y-1">
              {judgement.contributing_factors.map((f) => (
                <li key={f.factor} className="text-sm">
                  <span className="font-semibold text-foreground">
                    {f.factor}
                  </span>
                  {f.detail && (
                    <span className="text-muted-foreground"> — {f.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {judgement.recommendation && (
            <p className="rounded-md border border-status-blue/30 bg-status-blue/10 px-3 py-2 text-sm text-foreground">
              {judgement.recommendation}
            </p>
          )}
        </div>
      ) : (
        // The measured half above still stands.
        <p className="text-sm text-muted-foreground">
          No reading was produced. The measured figures above are unaffected.
        </p>
      )}
    </div>
  );
}

function FlightRow({ flight }: { flight: FlightListItem }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AssessResult | null>(null);

  async function assess() {
    setPending(true);
    setResult(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    setResult(await assessDelayAction(flight.id, tz));
    setPending(false);
  }

  const data = result?.status === "ok" ? result.data : null;
  const band = data?.judgement?.risk_band ?? null;

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono font-bold text-foreground">
              {flight.flight_number}
            </span>
            <span className="text-sm text-status-blue">
              {flight.origin} → {flight.destination}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              ETD {hhmmZ(flight.scheduled_departure_at)}
            </span>
            <span className="rounded bg-muted/40 px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
              {flight.aircraft.tail_number}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {band && (
            <span
              className={
                "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase " +
                bandClasses(band)
              }
            >
              {band} risk
            </span>
          )}
          <button
            type="button"
            onClick={() => void assess()}
            disabled={pending}
            className="rounded-md border border-status-purple/40 bg-status-purple/10 px-3 py-1.5 text-xs font-semibold text-status-purple hover:bg-status-purple/20 disabled:opacity-50"
          >
            {pending ? "Assessing…" : data ? "Re-assess" : "Assess"}
          </button>
        </div>
      </div>

      {result && result.status !== "ok" && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-1.5 text-xs text-status-red"
        >
          {result.message}
        </p>
      )}

      {data && <Assessment data={data} />}
    </li>
  );
}

export function FlightRiskList({ flights }: { flights: FlightListItem[] }) {
  if (flights.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No flights scheduled on this day.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {flights.map((f) => (
        <FlightRow key={f.id} flight={f} />
      ))}
    </ul>
  );
}
