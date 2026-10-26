
import { DownloadPdfButton } from "@/components/dispatch/download-pdf-button";
import { CancelFlight } from "@/components/dispatch/cancel-flight";
import { EditFlightDialog } from "@/components/dispatch/edit-flight-dialog";
import { ReleaseButton } from "@/components/dispatch/release-button";
import { ReleasedFooter } from "@/components/dispatch/released-footer";
import { StatusBadge } from "@/components/dispatch/status-badge";
import { WithdrawRelease } from "@/components/dispatch/withdraw-release";
import { flightStops } from "@/lib/route";
import type { DispatchRisk } from "@/lib/api/dispatch-risk";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";
import type { ZoneTable } from "@/lib/format/local-time";

import { GeneratePdfButton } from "./generate-pdf-button";
import { RefreshWeatherButton } from "./refresh-weather-button";
import { RiskAssessmentPanel } from "./risk-assessment-panel";
import { DispatcherNotes } from "./risk-inputs";
import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — flight-state actions on top,
 * briefing-actions row below, then the risk assessment (#50) and the
 * dispatcher's notes.
 *
 * As of M2-G-15 this column owns ALL flight-state actions (Edit, Release,
 * Generate PDF) in addition to the existing briefing actions (Refresh
 * Weather, AI Review, Generate PDF). Before M2-G-15 those lived on a
 * separate `/dispatch/[flightId]` detail page — that page is now a redirect.
 *
 * Layout matches the legacy peregrineflight.com style — flat button rows
 * at the top of the column, no labeled SectionPanel wrappers around the
 * actions. Labels would add visual weight legacy didn't have.
 */
export function RightColumn({
  flight,
  aircraft = [],
  zones,
  hardBlockReason = null,
  pilotUserId = null,
  overridesAcknowledged = false,
  notamAckedIcaos = [],
  staleWeatherAcknowledged = false,
  acknowledgedWarnings = [],
  risk = null,
  canEditRisk = false,
}: {
  flight?: FlightDetail | null;
  /** Aircraft list for the Edit dialog's tail-swap selector. Only needed
   *  when a scheduled flight is selected; an empty array is fine
   *  otherwise (the selector hides itself when the list is empty). */
  aircraft?: AircraftListItem[];
  /** Base zones, for the Edit dialog's local times (#68). */
  zones?: ZoneTable;
  /** M2-G-5 — when set, the Generate PDF button is disabled and the
   *  tooltip explains why (e.g. "PIC has 2 hard-block currency
   *  items"). Null = no block, button behaves normally. */
  hardBlockReason?: string | null;
  /** M2-M-5 — currently-selected PIC; passed to the release action so
   *  the server-side compliance gate runs. */
  pilotUserId?: string | null;
  /** Every PIC hard block has a supervisor override on record for this
   *  flight. The backend checks the records itself; this tells it the
   *  packet expected them (a missing one is then override_missing). */
  overridesAcknowledged?: boolean;
  /** Forwarded to the release call — the backend requires one entry per
   *  routed stop and stores them as the release audit trail. */
  notamAckedIcaos?: string[];
  staleWeatherAcknowledged?: boolean;
  /** `?warns_acked=` — sent with the release; the backend refuses while
   *  a currency warning for the crew is missing. */
  acknowledgedWarnings?: string[];
  /** The flight's scored risk matrix (#50); null with no flight or when
   *  scoring failed. */
  risk?: DispatchRisk | null;
  /** DISPATCH_WRITERS: the dispatcher or Exec Admin. */
  canEditRisk?: boolean;
}) {
  return (
    <div className="space-y-5">
      {flight && (
        <div id="release-actions">
          <FlightActionsRow
            flight={flight}
            aircraft={aircraft}
            zones={zones}
            hardBlockReason={hardBlockReason}
            pilotUserId={pilotUserId}
            overridesAcknowledged={overridesAcknowledged}
            notamAckedIcaos={notamAckedIcaos}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
            acknowledgedWarnings={acknowledgedWarnings}
            // The same roles release, cancel and pull back (#90).
            canDispatch={canEditRisk}
          />
        </div>
      )}

      <SectionPanel title={null}>
        <div className="flex flex-wrap gap-3">
          <RefreshWeatherButton flightSelected={!!flight} />

          <button
            type="button"
            disabled
            title="AI Review · Coming in M4"
            className="btn-caps inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-status-purple/40 px-4 py-2 text-[0.72rem] text-status-purple opacity-60"
          >
            AI Review
          </button>

          <GeneratePdfButton
            flight={flight ?? null}
            hardBlockReason={hardBlockReason}
            pilotUserId={pilotUserId}
            overridesAcknowledged={overridesAcknowledged}
            notamAckedIcaos={notamAckedIcaos}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
            acknowledgedWarnings={acknowledgedWarnings}
          />
        </div>
      </SectionPanel>

      <RiskAssessmentPanel risk={risk} failed={!!flight && !risk} />

      {flight && risk && (
        <DispatcherNotes
          key={`${flight.id}-dispatcher-notes`}
          flightId={flight.id}
          risk={risk}
          canEdit={canEditRisk}
        />
      )}
    </div>
  );
}

/**
 * Flat row of flight-state actions, no labeled wrapper. Status badge is
 * inline with the buttons so you can see at a glance whether the flight
 * is scheduled / released / cancelled / completed.
 *
 *   scheduled  → [status pill] [Edit] [Release dispatch]
 *   released   → [status pill] + ReleasedFooter strip + [Download PDF],
 *                and before departure, for dispatch, [Pull back release]
 *                [Cancel flight] (#90)
 *   cancelled/
 *   completed  → [status pill] + small "no actions available" hint
 */
function FlightActionsRow({
  flight,
  aircraft,
  zones,
  hardBlockReason = null,
  pilotUserId = null,
  overridesAcknowledged = false,
  notamAckedIcaos = [],
  staleWeatherAcknowledged = false,
  acknowledgedWarnings = [],
  canDispatch = false,
}: {
  flight: FlightDetail;
  aircraft: AircraftListItem[];
  zones?: ZoneTable;
  /** The same gate as Generate PDF. Release dispatch used to skip it,
   *  so a dispatcher could release with warnings unacknowledged. */
  hardBlockReason?: string | null;
  /** Release arguments, forwarded straight to ReleaseButton. This row
   *  took only flight + aircraft, so the release path below had no way
   *  to reach the NOTAM acks the column already held — see the note on
   *  ReleaseButton. */
  pilotUserId?: string | null;
  overridesAcknowledged?: boolean;
  notamAckedIcaos?: string[];
  staleWeatherAcknowledged?: boolean;
  acknowledgedWarnings?: string[];
  /** DISPATCH_WRITERS: may pull a release back or cancel the flight (#90). */
  canDispatch?: boolean;
}) {
  if (flight.status === "scheduled") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={flight.status} />
          {/* #123: VFR unless marked IFR under Edit. */}
          <span className="eyebrow">{flight.is_ifr ? "IFR" : "VFR"}</span>
          <EditFlightDialog flight={flight} aircraft={aircraft} zones={zones} />
          {canDispatch ? (
            <CancelFlight flightId={flight.id} flightNumber={flight.flight_number} />
          ) : null}
          <ReleaseButton
            flightId={flight.id}
            flightNumber={flight.flight_number}
            stops={flightStops(flight)}
            hardBlockReason={hardBlockReason}
            pilotUserId={pilotUserId}
            overridesAcknowledged={overridesAcknowledged}
            notamAckedIcaos={notamAckedIcaos}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
            acknowledgedWarnings={acknowledgedWarnings}
          />
        </div>
        {hardBlockReason && (
          <p id="release-blocked-reason" className="text-xs text-status-red">
            Release blocked: {hardBlockReason}
          </p>
        )}
      </div>
    );
  }

  if (
    flight.status === "released" &&
    flight.released_at &&
    flight.released_by
  ) {
    // Who released it on one line, the actions under it: beside the
    // release line, three buttons stacked in the column's width (#90).
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={flight.status} />
          <ReleasedFooter
            releasedAt={flight.released_at}
            releasedBy={flight.released_by}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDispatch && !flight.actual_departure_at && (
            <WithdrawRelease flightId={flight.id} flightNumber={flight.flight_number} />
          )}
          <DownloadPdfButton flightId={flight.id} />
        </div>
      </div>
    );
  }

  // cancelled / completed
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge status={flight.status} />
      <span className="text-xs text-muted-foreground">
        This flight is {flight.status} — no actions available.
      </span>
    </div>
  );
}
