import Link from "next/link";

import { PlannedFuelForm } from "@/app/(app)/manifest/[flightId]/fuel-form";
import { linkCaps } from "@/components/ff/controls";
import { FratSignoffs } from "@/components/frat/frat-signoffs";
import { BalanceScopeNote } from "@/components/manifest/balance-scope-note";
import { LegLoadPanel } from "@/components/manifest/leg-load-panel";
import type { FlightLoad } from "@/lib/api/manifest";
import type { FlightDetail, FratAssessmentResponse } from "@/lib/api/types";
import { fuelEstimateLine, fuelPlanningNote } from "@/lib/flights/fuel-estimate";

function lb(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(Number(value)).toLocaleString("en-US")} lb`;
}

/**
 * The fuel the flight leaves with, what it is worked out from, and each
 * leg's load with the fuel the legs before it burn (client, 18 Nov: "I
 * should have a greater useful load leaving PAMO back to PABE"). The
 * figures above are the tightest leg's, which is what the release judges.
 * Dispatch plans the fuel here, as on the manifest.
 */
function FuelAndLegs({
  flightId,
  data,
  isIfr,
  canPlanFuel,
}: {
  flightId: string;
  data: FlightLoad;
  isIfr: boolean;
  canPlanFuel: boolean;
}) {
  const gate = data.load;
  if (!gate) return null;
  const legs = gate.by_leg ?? [];
  const departs = legs.length > 1 ? legs[0].fuel_lbs : gate.fuel_lbs;
  const basis =
    departs == null
      ? "not counted yet"
      : gate.fuel_basis === "planned"
        ? "planned"
        : gate.fuel_basis === "estimated"
          ? "estimated"
          : "";
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-sm text-foreground">
        <span className="field-label mr-2">Fuel at departure</span>
        <span className="tabular-nums">{departs == null ? "—" : lb(departs)}</span>
        {basis ? <span className="text-muted-foreground">{`, ${basis}`}</span> : null}
      </p>
      {gate.fuel_basis === "estimated" && gate.fuel_estimate ? (
        <p className="text-xs text-muted-foreground">
          {`${fuelEstimateLine(gate.fuel_estimate)} ${fuelPlanningNote(gate.fuel_estimate, { is_ifr: isIfr })}`}
        </p>
      ) : null}
      {legs.length > 1 ? (
        <>
          {gate.leg ? (
            <p className="text-xs text-muted-foreground">
              {`The figures above are the tightest leg’s, ${gate.leg}. Each leg after the first leaves with less fuel:`}
            </p>
          ) : null}
          <LegLoadPanel legs={legs} burned={gate.leg_fuel_burned !== false} className="rounded-md" />
        </>
      ) : null}
      {canPlanFuel ? (
        data.has_manifest ? (
          <PlannedFuelForm
            // A new one for each flight: picking another flight on the packet
            // keeps the page, and a figure typed for the last flight would
            // otherwise stay in the box and be saved on this one (Codex, #496).
            key={flightId}
            flightId={flightId}
            current={gate.fuel_basis === "planned" && departs != null ? String(departs) : null}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {"Start the flight’s manifest to plan its fuel. "}
            <Link href={`/manifest/${flightId}`} className={linkCaps}>
              Open the manifest ›
            </Link>
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * What the release stands on, beside the release (#155). The client,
 * 10/29 (item 51): "The release page doesn't show the FRAT status or
 * weight and balance. The dispatcher can't see either before releasing."
 *
 * The FRAT: who filed it, its risk, the two sign-offs (the dispatcher
 * signs here), and what it still needs. The load: the one the release
 * judges, from the manifest or, without one, from the numbers typed on
 * the flight.
 */
export function ReleaseReadinessPanel({
  flight,
  frat,
  fratUnavailable,
  load,
  timeZone,
  canSignForDispatch,
  canPlanFuel = false,
  buildGaps = [],
  part,
}: {
  flight: FlightDetail;
  frat: FratAssessmentResponse | null;
  /** The FRAT couldn't be read: release still checks it. */
  fratUnavailable: boolean;
  load: FlightLoad | null;
  timeZone: string;
  canSignForDispatch: boolean;
  /** The viewer may plan the flight's fuel (the manifest's editors). */
  canPlanFuel?: boolean;
  /** What the flight still needs before dispatch signs its FRAT (#175). */
  buildGaps?: string[];
  /** One card for the packet in steps (24 Nov): the FRAT, or the weight
   *  and balance. Both without. */
  part?: "frat" | "load";
}) {
  const release = load?.release ?? null;
  const remaining = release?.remaining_lbs === null || release === null ? null : Number(release.remaining_lbs);
  const over = remaining !== null && remaining < 0;
  const blockers = frat?.release_blockers ?? [];

  return (
    <section aria-label="Release readiness" className="space-y-3">
      {part !== "load" && (
        <div className="rounded-lg border border-border bg-card">
          <header
            className={`flex flex-wrap items-baseline gap-2 border-b border-border px-5 py-3 ${part ? "justify-end" : "justify-between"}`}
          >
            {/* In its step of the packet, the step's own title names it. */}
            {part ? null : <h2 className="section-title">FRAT</h2>}
            <Link href={`/frat/${flight.id}`} className={linkCaps}>
              {frat ? "Open FRAT ›" : "File the FRAT ›"}
            </Link>
          </header>
          <div className="space-y-2 px-5 py-3 text-sm">
            {fratUnavailable ? (
              <p className="text-muted-foreground">The FRAT couldn't be read just now. Release still checks it.</p>
            ) : frat === null ? (
              <p className="text-foreground">
                No FRAT on this flight yet. Dispatch scores it for the PIC and signs it once the flight is
                built; then the pilot signs it at preflight step 1. The flight can't be released until both
                have.
              </p>
            ) : (
              <>
                <p className="text-foreground">
                  {/* Its level now, which follows the packet (17 Nov). */}
                  {`Risk ${(frat.current_risk_level ?? frat.risk_level).toUpperCase()} · total ${frat.total_score}`}
                  {frat.current_risk_level && frat.current_risk_level !== frat.risk_level
                    ? ` · filed at ${frat.risk_level.toUpperCase()}`
                    : ""}
                  {frat.filed_by_name ? ` · filed by ${frat.filed_by_name}` : ""}
                </p>
                {blockers.length > 0 ? (
                  <ul className="list-disc pl-5 text-status-yellow">
                    {blockers.map((b) => (
                      <li key={b.code}>
                        <span className="text-foreground">{b.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-status-green">Signed by both: the FRAT doesn&apos;t hold the release.</p>
                )}
              </>
            )}
          </div>
          {frat ? (
            <div className="px-5 pb-4">
              <FratSignoffs
                flightId={flight.id}
                frat={frat}
                timeZone={timeZone}
                canSign={{ pilot: false, dispatcher: canSignForDispatch }}
                buildGaps={buildGaps}
              />
            </div>
          ) : null}
        </div>
      )}

      {part !== "frat" && (
        <div className={`rounded-lg border bg-card ${over ? "border-status-red/50" : "border-border"}`}>
          {part ? null : (
            <header className="border-b border-border px-5 py-3">
              <h2 className="section-title">Weight and balance</h2>
            </header>
          )}
          <div className="px-5 py-3 text-sm">
            <BalanceScopeNote />
            {release === null ? (
              <p className="text-muted-foreground">The load couldn&apos;t be read just now. Release still checks it.</p>
            ) : release.useful_load_lbs === null ? (
              <p className="text-status-red">
                {`${flight.aircraft.tail_number} has no max payload on record, so the load can't be checked. Set it in Settings → Fleet.`}
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  <div>
                    <dt className="field-label">Useful load</dt>
                    <dd className="tabular-nums">{lb(release.useful_load_lbs)}</dd>
                  </div>
                  <div>
                    <dt className="field-label">Crew and fuel</dt>
                    <dd className="tabular-nums">
                      {lb(release.useful_load_lbs - Number(release.payload_lbs) - (remaining ?? 0))}
                    </dd>
                  </div>
                  <div>
                    <dt className="field-label">Payload</dt>
                    <dd className="tabular-nums">{lb(release.payload_lbs)}</dd>
                  </div>
                  <div>
                    <dt className="field-label">{over ? "Over by" : "Left"}</dt>
                    <dd className={`tabular-nums font-semibold ${over ? "text-status-red" : "text-status-green"}`}>
                      {lb(remaining === null ? null : Math.abs(remaining))}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  {release.basis === "manifest"
                    ? "From the flight's manifest."
                    : "No manifest yet: from the passengers and cargo typed on the flight, passengers at 190 lb."}
                  {over ? " The release refuses a load over the aircraft's useful load." : ""}
                </p>
                {load ? (
                  <FuelAndLegs flightId={flight.id} data={load} isIfr={Boolean(flight.is_ifr)} canPlanFuel={canPlanFuel} />
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
