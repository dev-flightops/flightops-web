"use client";

import { useMemo, useState, useTransition } from "react";

import type { FlightDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
}

/**
 * Step 3 — Weather + NOTAM Review (Spec 4 §"The 8 steps / 3").
 *
 * Spec gate: one acknowledgment per routing airport ("I have reviewed
 * all weather and NOTAMs for [ICAO]"). All required before Continue.
 *
 * Structurally mirrors legacy `templates/dispatch/pilot_notam_ack.html`:
 *   - Card per airport with the ICAO header + a placeholder summary
 *     of what would be shown (METAR / TAF / village weather board)
 *   - Inline acknowledgment checkbox per card
 *   - Note: dispatcher acknowledgment (the legacy "Dispatcher
 *     Acknowledgment" summary) lives in the dispatch packet flow,
 *     not here. The PILOT acknowledgment in this step is intentionally
 *     separate per Spec 4: "This is the PILOT acknowledgment —
 *     separate from the dispatcher acknowledgment on the PDF."
 *
 * Weather + NOTAM data fetch will plug into /weather/metar/{icao} +
 * /weather/taf/{icao} + /weather/briefings in a follow-up; the
 * gate + ack structure is what makes the regulatory trail.
 */
export function WeatherAndNotamStep({ flightId, flight }: Props) {
  // The flight route is the origin → destination pair today; multi-leg
  // routes ship with the elog Tab 2 work. Dedupe in case origin == dest.
  const airports = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const icao of [flight.origin, flight.destination]) {
      if (icao && !seen.has(icao)) {
        seen.add(icao);
        list.push(icao);
      }
    }
    return list;
  }, [flight.origin, flight.destination]);

  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAcked = airports.every((icao) => acked.has(icao));
  const canSubmit = allAcked && !pending;

  const toggle = (icao: string) => {
    setAcked((prev) => {
      const next = new Set(prev);
      if (next.has(icao)) next.delete(icao);
      else next.add(icao);
      return next;
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 3, {
        airport_acks: airports.map((icao) => ({
          icao,
          acknowledged_at: new Date().toISOString(),
        })),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 3
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Weather and NOTAM Review
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Review the current weather and active NOTAMs for every routing
          airport. Acknowledge each one — this PILOT acknowledgment is
          separate from the dispatcher acknowledgment on the release PDF
          and creates its own audit row.
        </p>

        <ul className="space-y-2">
          {airports.map((icao) => {
            const isAcked = acked.has(icao);
            return (
              <li
                key={icao}
                className={cn(
                  "rounded-lg border bg-background px-4 py-3 text-xs transition-colors",
                  isAcked
                    ? "border-status-green/40 bg-status-green/5"
                    : "border-border",
                )}
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-base font-bold text-foreground">
                    {icao}
                  </span>
                  {isAcked && (
                    <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-green">
                      Acknowledged
                    </span>
                  )}
                </div>
                <p className="mb-3 text-muted-foreground">
                  METAR, TAF, village weather board field reports + all
                  active NOTAMs for {icao} will render here. The
                  weather-service endpoints (METAR / TAF / briefings)
                  wire in alongside the elog Tab 2 weather lookup
                  work — for now this card surfaces the spec-required
                  ack control + an inline placeholder.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={isAcked}
                    onChange={() => toggle(icao)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-status-blue"
                  />
                  <span>
                    I have reviewed all weather and NOTAMs for{" "}
                    <span className="font-mono">{icao}</span>.
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 4 →"}
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
