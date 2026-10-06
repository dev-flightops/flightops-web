import type { DispatchRisk } from "@/lib/api/dispatch-risk";
import type { FlightDetail, RouteFreshness } from "@/lib/api/types";

import { AlternateReviewPanel } from "./alternate-review-panel";
import { FuelOrderPanel } from "./fuel-order-panel";
import { LoadTeamPanel } from "./load-team-panel";
import { MaintenancePanel } from "./maintenance-panel";
import { NotamAcknowledgmentPanel } from "./notam-acknowledgment-panel";
import {
  CompanyRiskInputs,
  ComplianceGatesInputs,
  ManagementTriggers,
  NonCertifiedNotes,
} from "./risk-inputs";
import { RouteInput } from "./route-input";
import { SectionPanel } from "./section-panel";
import { StaleWeatherAck } from "./stale-weather-ack";
import { WeatherPanel } from "./weather-panel";

/**
 * Left column of the dispatch packet form, matching the legacy
 * `templates/dispatch/form.html` layout (lines 432-602):
 *
 *   Route → Weather & ATIS → NOTAM Review → Compliance Gates
 *   → Fuel → Load Team → Company Risk Inputs → Management
 *   → Non-Certified Weather Notes
 *
 * Live as of M2-G-12:
 *   - Route textarea — live; commits to ?route= search param on blur
 *   - Weather & ATIS — METAR + TAF for every ICAO in the route, one
 *     /weather/batch round-trip (M2-M-12)
 *   - Maintenance & Airworthiness — open MELs + squawks via
 *     maintenance-service (M2-M-8)
 *   - Fuel — the departure base's supplier and contract price
 *   - Load Team — assign the ramp team, same row as /ramp-ops
 *
 *   - Compliance Gates, Company Risk Inputs, Management Approval
 *     Triggers and Non-Certified Weather Notes — the dispatch risk
 *     matrix's inputs (#50): worked out from our data where it can be,
 *     each overridable, saved per flight
 *
 * NOTAM Review still blocked on M2-M-4 (FAA NOTAM proxy).
 *
 * `icaos` is the resolved routing — either parsed from `?route=` in the
 * URL or [origin, destination] from the selected flight. Empty array
 * means "no routing context", which triggers the Weather panel's
 * placeholder.
 */
export async function LeftColumn({
  flight,
  icaos,
  notamAckedIcaos,
  weatherFreshness,
  staleWeatherAcknowledged,
  canSignOffMaintenance = false,
  risk = null,
  canEditRisk = false,
}: {
  flight: FlightDetail | null;
  icaos: string[];
  /** ICAOs the dispatcher has manually acknowledged NOTAMs for (from
   *  the `?notams_acked=` query param). Empty when no acks yet. */
  notamAckedIcaos: string[];
  /** Staleness verdict for the route. Null when the freshness call
   *  failed — the ack control hides, matching the release gate, which
   *  also declines to block on a verdict it could not obtain. */
  weatherFreshness: RouteFreshness | null;
  staleWeatherAcknowledged: boolean;
  /** Maintenance sign-off (AIRWORTHINESS_WRITERS): defer, close, resolve. */
  canSignOffMaintenance?: boolean;
  /** The flight's scored risk matrix (#50): its saved inputs and what the
   *  system worked out. Null with no flight, or when scoring failed. */
  risk?: DispatchRisk | null;
  /** DISPATCH_WRITERS: the dispatcher or Exec Admin. */
  canEditRisk?: boolean;
}) {
  return (
    <div className="space-y-5">
      <SectionPanel title="Route">
        <p className="mb-2 text-xs text-muted-foreground">
          One ICAO per line — origin first, destination last. Blur (or
          Cmd/Ctrl-Enter) refreshes the Weather panel for every stop.
        </p>
        <RouteInput defaultText={icaos.join("\n")} />
      </SectionPanel>

      <WeatherPanel icaos={icaos} />

      {/* Sits directly under the weather it refers to — the dispatcher
          reads the stale METAR, then ticks the box, without hunting for
          a control somewhere else on the page. Renders nothing when the
          route's weather is current. */}
      <StaleWeatherAck
        freshness={weatherFreshness}
        acknowledged={staleWeatherAcknowledged}
      />

      <AlternateReviewPanel icaos={icaos} />

      <NotamAcknowledgmentPanel
        icaos={icaos}
        ackedFromUrl={notamAckedIcaos}
      />

      {flight && risk ? (
        <ComplianceGatesInputs
          key={flight.id}
          flightId={flight.id}
          risk={risk}
          canEdit={canEditRisk}
        />
      ) : (
        <RiskInputsUnavailable flightSelected={!!flight} />
      )}

      <MaintenancePanel flight={flight} canSignOff={canSignOffMaintenance} />

      <FuelOrderPanel flight={flight} />

      <LoadTeamPanel flight={flight} />

      {flight && risk && (
        <>
          <CompanyRiskInputs
            key={`${flight.id}-company`}
            flightId={flight.id}
            risk={risk}
            canEdit={canEditRisk}
          />
          <ManagementTriggers
            key={`${flight.id}-management`}
            flightId={flight.id}
            risk={risk}
            canEdit={canEditRisk}
          />
          <NonCertifiedNotes
            key={`${flight.id}-notes`}
            flightId={flight.id}
            risk={risk}
            canEdit={canEditRisk}
          />
        </>
      )}
    </div>
  );
}

function RiskInputsUnavailable({ flightSelected }: { flightSelected: boolean }) {
  return (
    <SectionPanel title="Risk Inputs">
      <p className="text-xs text-muted-foreground">
        {flightSelected
          ? "The risk inputs couldn't be loaded just now. Try Refresh Weather in a moment."
          : "Pick a flight to set its compliance gates, risk inputs and management triggers."}
      </p>
    </SectionPanel>
  );
}
