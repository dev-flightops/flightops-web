import { DownloadPdfButton } from "@/components/dispatch/download-pdf-button";
import { EditFlightDialog } from "@/components/dispatch/edit-flight-dialog";
import { ReleaseButton } from "@/components/dispatch/release-button";
import { ReleasedFooter } from "@/components/dispatch/released-footer";
import { StatusBadge } from "@/components/dispatch/status-badge";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";

import { GeneratePdfButton } from "./generate-pdf-button";
import { RefreshWeatherButton } from "./refresh-weather-button";
import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — action buttons + data panels.
 *
 * As of M2-G-15 this column owns ALL flight-state actions (Edit, Release,
 * Generate PDF) in addition to the existing briefing actions (Refresh
 * Weather, AI Review). Before M2-G-15 those lived on a separate
 * `/dispatch/[flightId]` detail page — that page is now a redirect.
 *
 *   - **Flight actions panel** — shows status + the right action for the
 *     current state. Scheduled flights get Edit + Release; released
 *     flights get the ReleasedFooter + PDF download. Hidden when no
 *     flight is selected (action panel collapses).
 *   - **Briefing actions** — Refresh Weather is live (M2-G-1 router.refresh
 *     re-runs the WeatherPanel server component, backend cache decides
 *     whether AWC is actually hit). AI Review still disabled (M4).
 *   - **Generate PDF** — opens the release PDF; for scheduled flights, the
 *     button doubles as a release-confirm dialog (M1 behavior).
 */
export function RightColumn({
  flight,
  aircraft = [],
}: {
  flight?: FlightDetail | null;
  /** Aircraft list for the Edit dialog's tail-swap selector. Only needed
   *  when a scheduled flight is selected; an empty array is fine
   *  otherwise (the selector hides itself when the list is empty). */
  aircraft?: AircraftListItem[];
}) {
  return (
    <div className="space-y-5">
      {flight && <FlightActionsPanel flight={flight} aircraft={aircraft} />}

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

function FlightActionsPanel({
  flight,
  aircraft,
}: {
  flight: FlightDetail;
  aircraft: AircraftListItem[];
}) {
  return (
    <SectionPanel
      title="Flight actions"
      titleAction={<StatusBadge status={flight.status} />}
    >
      {flight.status === "scheduled" && (
        <div className="flex flex-wrap items-center gap-3">
          <EditFlightDialog flight={flight} aircraft={aircraft} />
          <ReleaseButton
            flightId={flight.id}
            flightNumber={flight.flight_number}
            origin={flight.origin}
            destination={flight.destination}
          />
        </div>
      )}

      {flight.status === "released" &&
        flight.released_at &&
        flight.released_by && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ReleasedFooter
              releasedAt={flight.released_at}
              releasedBy={flight.released_by}
            />
            <DownloadPdfButton flightId={flight.id} />
          </div>
        )}

      {(flight.status === "cancelled" || flight.status === "completed") && (
        <p className="text-xs text-muted-foreground">
          This flight is {flight.status} — no actions available.
        </p>
      )}
    </SectionPanel>
  );
}
