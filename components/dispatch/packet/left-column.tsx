import type { FlightDetail } from "@/lib/api/types";

import { AlternateReviewPanel } from "./alternate-review-panel";
import { FuelOrderPanel } from "./fuel-order-panel";
import { MaintenancePanel } from "./maintenance-panel";
import { NotamAcknowledgmentPanel } from "./notam-acknowledgment-panel";
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
  notamAckedIcaos,
}: {
  flight: FlightDetail | null;
  icaos: string[];
  /** ICAOs the dispatcher has manually acknowledged NOTAMs for (from
   *  the `?notams_acked=` query param). Empty when no acks yet. */
  notamAckedIcaos: string[];
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

      <NotamAcknowledgmentPanel
        icaos={icaos}
        ackedFromUrl={notamAckedIcaos}
      />

      <SectionPanel title="Compliance Gates">
        <div className="grid grid-cols-2 gap-4">
          <YesNoSelect label="Hazmat Flight" />
          <YesNoSelect label="Hazmat Approved" />
          <YesNoSelect label="MEL/DMI on A/C" />
          <YesNoSelect label="Pilot Actions Required" />
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
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            disabled
            className="cursor-not-allowed"
            aria-label="MEL/DMI pilot actions complete"
          />
          MEL/DMI pilot actions complete
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          FAR Part 117 crew legality lands once the crew-service ships. MEL
          acknowledgement + airworthiness is also surfaced in the Maintenance
          panel below.
        </p>
      </SectionPanel>

      <MaintenancePanel flight={flight} />

      <FuelOrderPanel flight={flight} />

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

      <SectionPanel title="Management Approval Triggers">
        <div className="grid grid-cols-3 gap-4">
          <YesNoSelect label="Outside Pilot Restrictions" />
          <YesNoSelect label="VFR Mtn Terrain at Night" />
          <YesNoSelect label="<4 hrs until MX" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            disabled
            className="cursor-not-allowed"
            aria-label="Mgmt approval obtained"
          />
          Mgmt approval obtained
        </label>
        <p className="mt-2 text-[0.7rem] text-muted-foreground/70">
          Yes/No flags are dispatcher-set today; crew-service (M3) will
          auto-trigger management sign-off when risk inputs + crew legality
          combine to require it.
        </p>
      </SectionPanel>

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

function YesNoSelect({
  label,
  defaultYes = false,
}: {
  label: string;
  /** Some legacy fields default to "Yes" (Reporting OK); most default to
   *  "No". The disabled select still needs the right initial option. */
  defaultYes?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </label>
      <select disabled className="ff-input cursor-not-allowed">
        <option>{defaultYes ? "Yes" : "No"}</option>
        <option>{defaultYes ? "No" : "Yes"}</option>
      </select>
    </div>
  );
}
