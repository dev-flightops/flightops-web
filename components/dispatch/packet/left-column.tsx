import type { FlightDetail } from "@/lib/api/types";

import { AlternateReviewPanel } from "./alternate-review-panel";
import { MaintenancePanel } from "./maintenance-panel";
import { RouteInput } from "./route-input";
import { DisabledPanel, SectionPanel } from "./section-panel";
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
 *   - Non-Certified Weather Notes textarea
 *
 * NOTAM Review still blocked on M2-M-4 (FAA NOTAM proxy). Fuel, Load
 * Team, Mgmt Approval all wait on their respective services.
 *
 * `icaos` is the resolved routing — either parsed from `?route=` in the
 * URL or [origin, destination] from the selected flight. Empty array
 * means "no routing context", which triggers the Weather panel's
 * placeholder.
 */
export async function LeftColumn({
  flight,
  icaos,
}: {
  flight: FlightDetail | null;
  icaos: string[];
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

      <AlternateReviewPanel icaos={icaos} />

      <DisabledPanel
        title="NOTAM Review"
        milestone="M2"
        hint="Enter your routing above to pull NOTAMs for departure, destination, and intermediate stops. Powered by the weather-service NOTAM proxy when it ships."
      />

      <SectionPanel title="Compliance Gates">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Hazmat Flight
            </label>
            <select disabled className="ff-input cursor-not-allowed">
              <option>No</option>
              <option>Yes</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              IFR / VFR
            </label>
            <select disabled className="ff-input cursor-not-allowed">
              <option>VFR</option>
              <option>IFR</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          FAR Part 117 crew legality lands once the crew-service ships. MEL
          acknowledgement + airworthiness is now surfaced in the Maintenance
          panel below.
        </p>
      </SectionPanel>

      <MaintenancePanel flight={flight} />

      <DisabledPanel
        title="Fuel"
        milestone="M2"
        hint="Auto-calculated from base + tail + route once the ground-service fuel module ships."
        accent="yellow"
      />

      <DisabledPanel
        title="Load Team"
        milestone="M3"
        hint="Assignments + acknowledgements once crew-service ships."
        accent="blue"
      />

      <SectionPanel title="Company Risk Inputs">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Reporting OK
            </label>
            <select disabled className="ff-input cursor-not-allowed">
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Night Ops
            </label>
            <select disabled className="ff-input cursor-not-allowed">
              <option>No</option>
              <option>Yes</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Crosswind (kt)
            </label>
            <input
              type="number"
              disabled
              placeholder="auto"
              className="ff-input cursor-not-allowed"
            />
          </div>
        </div>
      </SectionPanel>

      <DisabledPanel
        title="Management Approval Triggers"
        milestone="M3"
        hint="Surfaces when risk inputs + crew legality + weather combine to require management sign-off. Needs the crew + safety services."
      />

      <SectionPanel title="Non-Certified Weather Notes">
        <p className="mb-2 text-xs text-muted-foreground">
          FAA WeatherCams / SayWeather advisory (for awareness only — not
          certified).
        </p>
        <textarea
          rows={5}
          disabled
          placeholder="Paste WeatherCams or SayWeather text here..."
          className="ff-input font-mono text-sm"
        />
      </SectionPanel>
    </div>
  );
}
