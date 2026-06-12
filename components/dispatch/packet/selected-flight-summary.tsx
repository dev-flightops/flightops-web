import type { FlightDetail } from "@/lib/api/types";

import { DEMO_PIC_CERT, DEMO_PIC_NAME } from "./demo-placeholders";

/**
 * Inline summary rows shown directly below the Load-from-Schedule dropdown
 * once a flight is selected — mirrors the legacy `templates/dispatch/form.html`
 * post-selection state from the screenshot:
 *
 *   ✓ GV785  PAAN → PABE
 *   N207GC  ·  PIC: Sam Kameroff · DEMO-CERT-1-005 · 0 pax · 0 lbs cargo
 *   ──────────────────────────────────────────────
 *   Scheduled PIC: Sam Kameroff       (blue tint)
 *   ──────────────────────────────────────────────
 *   Needs attention: No passengers or cargo on manifest   (orange tint)
 *
 * Three rows:
 *   1. Green confirmation strip — always rendered when a flight is loaded
 *   2. Scheduled PIC row — placeholder today (crew-service lands M3); we
 *      render it as a muted "Scheduled PIC: not assigned (M3)" row so the
 *      layout matches the legacy
 *   3. Warnings row — appears if pax_count == 0 OR cargo_lbs == 0,
 *      matching the legacy's pre-release validation hints
 */
export function SelectedFlightSummary({ flight }: { flight: FlightDetail }) {
  const warnings = warningsFor(flight);

  return (
    <div className="mt-3 space-y-2">
      {/* Green confirmation row */}
      <div className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-4 py-3 text-xs">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-status-green">✓</span>
          <span className="font-bold text-status-green">
            {flight.flight_number}
          </span>
          <span className="font-mono text-foreground">
            {flight.origin} → {flight.destination}
          </span>
        </div>
        {/* Legacy pattern: large spaces between the three groups
            (tail · PIC-group · load-group), bullets only inside the
            PIC group (name · cert) and the load group (pax · cargo). */}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
          <span>{flight.aircraft.tail_number}</span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span>
              PIC: <span className="font-semibold text-foreground">{DEMO_PIC_NAME}</span>
            </span>
            <Sep />
            <span>{DEMO_PIC_CERT}</span>
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span>{flight.pax_count} pax</span>
            <Sep />
            <span>{flight.cargo_lbs.toLocaleString()} lbs cargo</span>
          </span>
        </div>
      </div>

      {/* Scheduled PIC row — blue */}
      <div
        className="rounded-md border border-status-blue/40 bg-status-blue/[0.08] px-4 py-2.5 text-xs"
        title="Crew-service ships in M3 — value shown is the demo placeholder"
      >
        <span className="font-bold text-status-blue">Scheduled PIC:</span>{" "}
        <span className="font-semibold text-foreground">{DEMO_PIC_NAME}</span>
      </div>

      {/* Warnings row — listed when any spec check trips. Spec lists:
          manifest has no pax, manifest has no cargo, weight discrepancy,
          missing aircraft data, manifest still open. */}
      {warnings.length > 0 && (
        <div className="rounded-md border border-status-orange/40 bg-status-orange/[0.08] px-4 py-2.5 text-xs">
          <span className="font-bold text-status-orange">
            Needs attention:
          </span>{" "}
          <span className="text-foreground/80">
            {warnings.length === 1 ? (
              warnings[0]
            ) : (
              <ul className="ml-1 mt-0.5 list-disc pl-4">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Spec checks per the formal Dispatch Portal spec, Component 1:
 *   "Orange banner if manifest has no passengers, weight discrepancy,
 *    missing aircraft data, or any other issue that needs review before
 *    release"
 *
 * Each check is independent — multiple can fire at once and render as a
 * bulleted list.
 */
function warningsFor(flight: FlightDetail): string[] {
  const out: string[] = [];

  if (flight.pax_count === 0 && flight.cargo_lbs === 0) {
    out.push("No passengers or cargo on manifest");
  } else if (flight.pax_count === 0) {
    out.push("No passengers on manifest");
  } else if (flight.cargo_lbs === 0) {
    out.push("No cargo on manifest");
  }

  // Spec also lists "weight discrepancy" but FlightDetail.aircraft is
  // an AircraftRef (no max_payload_lbs). When we land the embellished
  // AircraftDetail on the dispatch fetch, fold the payload check in
  // here as well.

  // Missing aircraft data — model or tail blank shouldn't happen
  // for a scheduled flight, but the spec calls it out explicitly.
  if (!flight.aircraft.tail_number || !flight.aircraft.model) {
    out.push("Aircraft record is missing tail or model");
  }

  return out;
}

function Sep() {
  return <span className="text-muted-foreground/40">·</span>;
}
