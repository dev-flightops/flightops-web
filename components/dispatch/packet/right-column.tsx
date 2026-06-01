import type { FlightDetail } from "@/lib/api/types";

import { GeneratePdfButton } from "./generate-pdf-button";
import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — action buttons + data
 * panels + dispatcher notes. Matches legacy
 * `templates/dispatch/form.html` lines 609-680.
 *
 * M1 wiring:
 *   - Refresh Weather → disabled (weather-service M2)
 *   - AI Review → disabled (ai-service M4)
 *   - Generate PDF → ENABLED once a flight is selected. Hits the
 *     per-flight `/api/dispatch/<id>/release.pdf` endpoint we already
 *     ship for the flight-detail page. This is the M1 stop-gap until
 *     the full packet PDF lands in M2-M3 once weather + legality data
 *     sources are wired. Without a selection, the button stays
 *     disabled with a tooltip pointing the user at the dropdown above.
 */
export function RightColumn({ flight }: { flight?: FlightDetail | null }) {
  return (
    <div className="space-y-5">
      <SectionPanel title={null}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title="Refresh Weather · Coming in M2"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground opacity-60"
          >
            Refresh Weather
          </button>

          <button
            type="button"
            disabled
            title="AI Review · Coming in M4"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-status-purple/40 bg-transparent px-4 py-2 text-xs font-semibold text-status-purple opacity-60"
          >
            ✨ AI Review
          </button>

          <GeneratePdfButton flight={flight ?? null} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Full packet generation (weather summary, MEL ack, crew legality
          snapshot, risk score) lands once those services ship. M1 generates
          the per-flight release PDF directly from the selected flight.
        </p>
      </SectionPanel>

      <SectionPanel title="Briefing data">
        <p className="text-xs text-muted-foreground">
          When the packet is refreshed, this panel fills with weather summary,
          weight &amp; balance, performance, and risk score cards. Empty until
          the supporting services ship.
        </p>
      </SectionPanel>

      <SectionPanel title="Dispatcher Notes">
        <textarea
          rows={4}
          disabled
          placeholder="Internal notes for this packet — visible to dispatch + ops, not on the released PDF."
          className="ff-input text-sm"
        />
      </SectionPanel>
    </div>
  );
}

