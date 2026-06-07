import type { FlightDetail } from "@/lib/api/types";

import { GeneratePdfButton } from "./generate-pdf-button";
import { RefreshWeatherButton } from "./refresh-weather-button";
import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — action buttons + data
 * panels + dispatcher notes. Matches legacy
 * `templates/dispatch/form.html` lines 609-680.
 *
 * M2-G-1 wiring:
 *   - Refresh Weather → live; uses router.refresh() to re-run the
 *     WeatherPanel server component. Backend cache (5 min METAR /
 *     30 min TAF) decides whether AWC actually gets hit.
 *   - AI Review → still disabled (ai-service M4)
 *   - Generate PDF → unchanged from M1 — opens the per-flight release
 *     PDF (with confirm dialog for scheduled flights). Full packet PDF
 *     still waits on M2-M-3+ data sources.
 */
export function RightColumn({ flight }: { flight?: FlightDetail | null }) {
  return (
    <div className="space-y-5">
      <SectionPanel title={null}>
        <div className="flex flex-wrap gap-3">
          <RefreshWeatherButton flightSelected={!!flight} />

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

