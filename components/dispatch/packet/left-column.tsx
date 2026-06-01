import { DisabledPanel, SectionPanel } from "./section-panel";

/**
 * Left column of the dispatch packet form, matching the legacy
 * `templates/dispatch/form.html` layout (lines 432-602):
 *
 *   Route → Weather & ATIS → NOTAM Review → Compliance Gates
 *   → Fuel → Load Team → Company Risk Inputs → Management
 *   → Non-Certified Weather Notes
 *
 * Live in M1:
 *   - Route textarea (free input — saved nowhere yet, just renders)
 *   - Non-Certified Weather Notes textarea (same)
 *
 * Everything else needs a service we don't have yet, so each renders
 * the legacy's own empty-state copy or a milestone-tagged placeholder.
 */
export function LeftColumn() {
  return (
    <div className="space-y-5">
      <SectionPanel title="Route">
        <p className="mb-2 text-xs text-muted-foreground">
          One ICAO per line — origin first, destination last
        </p>
        <textarea
          rows={6}
          disabled
          placeholder={"PAEE\nPAUN\nPAGM"}
          className="ff-input font-mono text-sm"
        />
      </SectionPanel>

      <DisabledPanel
        title="Weather & ATIS"
        milestone="M2"
        hint="Enter your routing above to pull METAR, TAF, ATIS, and village field reports for every stop. Powered by the weather-service when it ships."
      />

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
          Full compliance gating (FAR Part 117 legality, MEL ack, airworthiness)
          lands in M2–M3 once maintenance- and crew-services are live.
        </p>
      </SectionPanel>

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
